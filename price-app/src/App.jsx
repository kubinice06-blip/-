import { useState, useMemo, useEffect, useCallback } from "react";

const CURRENCIES = ["TWD","USD","JPY","CNY","HKD","KRW","EUR","GBP","AUD","SGD"];
const FALLBACK_RATES = { TWD:1,USD:32.5,JPY:0.215,CNY:4.48,HKD:4.16,KRW:0.024,EUR:35.2,GBP:41.0,AUD:21.0,SGD:24.0 };

const fmtTWD = (v) => new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",maximumFractionDigits:0}).format(v);
const fmtOrig = (v,code) => {
  try { return new Intl.NumberFormat("zh-TW",{style:"currency",currency:code,maximumFractionDigits:code==="JPY"||code==="KRW"?0:2}).format(v); }
  catch { return `${v} ${code}`; }
};

const emptyForm = () => ({
  name:"", note:"",
  basePrice:"", baseCurrency:"TWD",
  shipping:"", shippingCurrency:"TWD",
  serviceFee:"", serviceFeeCurrency:"TWD",
  tax:"", taxCurrency:"TWD",
  customPrice:"",
});

const CurrencySelect = ({ value, onChange }) => (
  <select value={value} onChange={e=>onChange(e.target.value)} style={{
    background:"#0f0e11",border:"1px solid #3a3440",borderRadius:"4px",
    padding:"8px 6px",color:"#c8a060",fontSize:"11px",cursor:"pointer",outline:"none",width:"70px",flexShrink:0,
  }}>
    {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
  </select>
);

export default function PriceManager() {
  // ── localStorage 持久化 ──────────────────────────────────────────
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pm_items") || "[]"); } catch { return []; }
  });
  const [markup, setMarkup] = useState(() => {
    try { return parseFloat(localStorage.getItem("pm_markup") || "1.2"); } catch { return 1.2; }
  });

  useEffect(() => { localStorage.setItem("pm_items", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("pm_markup", String(markup)); }, [markup]);

  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [markupInput, setMarkupInput] = useState(String(markup));
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [ratesStatus, setRatesStatus] = useState("loading");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, color="#60c890") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchRates = useCallback(async () => {
    setRatesStatus("loading");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:`Search for the latest exchange rates for these currencies to TWD (New Taiwan Dollar) today.
Return ONLY a valid JSON object with no extra text, like:
{"USD":32.5,"JPY":0.215,"CNY":4.48,"HKD":4.16,"KRW":0.024,"EUR":35.2,"GBP":41.0,"AUD":21.0,"SGD":24.0}`}]
        })
      });
      const data = await res.json();
      const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const match = text.match(/\{[^{}]+\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const merged = { TWD:1 };
        CURRENCIES.forEach(c => {
          if (c==="TWD") return;
          const v = Number(parsed[c]);
          merged[c] = (!isNaN(v) && v > 0) ? v : FALLBACK_RATES[c];
        });
        setRates(merged);
        setRatesStatus("live");
        setLastUpdated(new Date());
        showToast("匯率已更新為即時資料 ✓");
      } else { throw new Error("no json"); }
    } catch {
      setRates(FALLBACK_RATES);
      setRatesStatus("fallback");
      showToast("無法取得即時匯率，使用參考值", "#e0a060");
    }
  }, [showToast]);

  useEffect(() => { fetchRates(); }, []);
  useEffect(() => {
    const id = setInterval(fetchRates, 10*60*1000);
    return () => clearInterval(id);
  }, [fetchRates]);

  const toTWD = (amount, currency) => Number(amount||0) * (rates[currency]??1);
  const itemCost = (item) =>
    toTWD(item.basePrice,item.baseCurrency) +
    toTWD(item.shipping,item.shippingCurrency) +
    toTWD(item.serviceFee,item.serviceFeeCurrency) +
    toTWD(item.tax,item.taxCurrency);
  const salePrice = (item) => itemCost(item) * markup;
  const profit = (item) => salePrice(item) - itemCost(item);

  const handleChange = (e) => setForm({...form,[e.target.name]:e.target.value});
  const handleCur = (field,val) => setForm({...form,[field]:val});

  const handleSubmit = () => {
    if (!form.name||!form.basePrice) { showToast("請填寫商品名稱與進貨價","#e07060"); return; }
    const entry = { id:editId??Date.now(), ...form,
      basePrice:Number(form.basePrice), shipping:Number(form.shipping)||0,
      serviceFee:Number(form.serviceFee)||0, tax:Number(form.tax)||0,
      customPrice:Number(form.customPrice)||0 };
    if (editId) { setItems(items.map(i=>i.id===editId?entry:i)); showToast("已更新商品"); setEditId(null); }
    else { setItems([...items,entry]); showToast("已新增商品"); }
    setForm(emptyForm()); setShowForm(false);
  };

  const handleEdit = (item) => { setForm({...item,customPrice:item.customPrice||""}); setEditId(item.id); setShowForm(true); window.scrollTo({top:0,behavior:"smooth"}); };
  const handleDelete = (id) => { setItems(items.filter(i=>i.id!==id)); showToast("已刪除","#e07060"); };
  const handleCancel = () => { setForm(emptyForm()); setEditId(null); setShowForm(false); };

  const handleMarkup = (e) => {
    setMarkupInput(e.target.value);
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v>=1.01) setMarkup(v);
  };

  const previewCost = useMemo(() =>
    toTWD(form.basePrice,form.baseCurrency)+toTWD(form.shipping,form.shippingCurrency)+
    toTWD(form.serviceFee,form.serviceFeeCurrency)+toTWD(form.tax,form.taxCurrency),
  [form,rates]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items
      .filter(i=>i.name.toLowerCase().includes(q)||(i.note||"").toLowerCase().includes(q))
      .sort((a,b)=>{
        if (sortKey==="name") return a.name.localeCompare(b.name,"zh-TW");
        if (sortKey==="cost") return itemCost(a)-itemCost(b);
        if (sortKey==="sale") return salePrice(a)-salePrice(b);
        if (sortKey==="profit") return profit(a)-profit(b);
        return 0;
      });
  },[items,search,sortKey,rates,markup]);

  const stats = useMemo(()=>({
    count:filtered.length,
    totalCost:filtered.reduce((s,i)=>s+itemCost(i),0),
    totalSale:filtered.reduce((s,i)=>s+salePrice(i),0),
    totalProfit:filtered.reduce((s,i)=>s+profit(i),0),
  }),[filtered,rates,markup]);

  const exportCSV = () => {
    if (!items.length) { showToast("尚無資料可匯出","#e07060"); return; }
    const h = ["商品名稱","進貨幣","進貨價","運費幣","運費","服務費幣","服務費","稅金幣","稅金","總成本NT$",`系統售價×${markup}NT$`,"自訂售價NT$","利潤率%","利潤NT$","備註"];
    const rows = items.map(i=>{
      const cost=itemCost(i);
      const activePrice = i.customPrice ? Number(i.customPrice) : salePrice(i);
      const margin = cost>0 ? ((activePrice-cost)/cost*100).toFixed(1) : "—";
      return [i.name,i.baseCurrency,i.basePrice,i.shippingCurrency,i.shipping,
        i.serviceFeeCurrency,i.serviceFee,i.taxCurrency,i.tax,
        Math.round(cost),Math.round(salePrice(i)),i.customPrice?Math.round(i.customPrice):"",
        margin,Math.round(activePrice-cost),i.note||""];
    });
    const csv=[h,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="訂貨價格.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("已匯出 CSV ✓");
  };

  const ipt = { width:"100%",background:"#0f0e11",border:"1px solid #3a3440",borderRadius:"5px",padding:"8px 10px",color:"#e8e0d0",fontSize:"13px",outline:"none",boxSizing:"border-box",fontFamily:"inherit" };
  const lbl = { display:"block",fontSize:"10px",color:"#786860",letterSpacing:"1px",marginBottom:"5px" };
  const btn = (bg,fg) => ({ background:bg,color:fg,border:"none",borderRadius:"6px",padding:"9px 16px",fontSize:"12px",fontWeight:"700",cursor:"pointer" });
  const obtn = (fg,bc) => ({ background:"transparent",color:fg,border:`1px solid ${bc}`,borderRadius:"4px",padding:"4px 10px",fontSize:"11px",cursor:"pointer" });

  const rateColor = ratesStatus==="live"?"#60c890":ratesStatus==="loading"?"#c8a060":"#e07060";
  const rateIcon = ratesStatus==="live"?"●":ratesStatus==="loading"?"○":"△";
  const timeStr = lastUpdated ? `${String(lastUpdated.getHours()).padStart(2,"0")}:${String(lastUpdated.getMinutes()).padStart(2,"0")} 更新` : "";

  return (
    <div style={{minHeight:"100vh",background:"#0f0e11",fontFamily:"'Noto Serif TC',Georgia,serif",color:"#e8e0d0"}}>

      {toast&&<div style={{position:"fixed",top:"16px",left:"50%",transform:"translateX(-50%)",background:toast.color,color:"#0f0e11",padding:"10px 22px",borderRadius:"6px",fontWeight:"700",fontSize:"13px",zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,.5)",animation:"fadeIn .2s"}}>{toast.msg}</div>}

      {/* Header */}
      <div style={{borderBottom:"1px solid #2a2830",background:"linear-gradient(135deg,#1a1820,#12111a)",padding:"20px 24px",display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"10px",letterSpacing:"4px",color:"#a08060",textTransform:"uppercase",marginBottom:"4px"}}>訂貨管理系統</div>
          <h1 style={{margin:0,fontSize:"22px",fontWeight:"700",color:"#f0e8d8"}}>價格總覽</h1>
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
          <button title="點選重新整理匯率" onClick={fetchRates} style={{...obtn(rateColor,"transparent"),fontSize:"11px",padding:"5px 10px"}}>
            {rateIcon} {ratesStatus==="live"?"即時匯率":ratesStatus==="loading"?"更新中…":"參考匯率"} {timeStr}
          </button>
          <button style={btn(showSettings?"#3a3440":"#2a2830","#a08060")} onClick={()=>setShowSettings(!showSettings)}>⚙ 設定</button>
          <button style={btn("#1e2a38","#7090c0")} onClick={exportCSV}>↓ 匯出 CSV</button>
          <button style={btn(showForm?"#2a2830":"linear-gradient(135deg,#c8934a,#e0b060)",showForm?"#786860":"#1a1408")}
            onClick={()=>{setShowForm(!showForm);if(editId)handleCancel();}}>
            {showForm?"✕ 取消":"+ 新增商品"}
          </button>
        </div>
      </div>

      <div style={{padding:"22px 24px",maxWidth:"1200px",margin:"0 auto"}}>

        {/* Settings */}
        {showSettings&&(
          <div style={{background:"#1a1820",border:"1px solid #2a2830",borderRadius:"8px",padding:"18px 20px",marginBottom:"18px",animation:"fadeIn .2s"}}>
            <div style={{fontSize:"11px",color:"#a08060",letterSpacing:"2px",marginBottom:"14px"}}>⚙ 全域設定</div>
            <div style={{display:"flex",gap:"28px",flexWrap:"wrap",alignItems:"flex-start"}}>
              <div style={{minWidth:"180px"}}>
                <label style={lbl}>售價倍數　目前 ×{markup}　利潤 {((markup-1)*100).toFixed(0)}%</label>
                <input type="number" min="1.01" step="0.05" value={markupInput} onChange={handleMarkup} style={{...ipt,width:"120px"}} />
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                  <span style={lbl}>對台幣匯率（可手動覆蓋）</span>
                  <button style={obtn("#60c890","#304838")} onClick={fetchRates}>↻ 重新抓取即時匯率</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:"8px"}}>
                  {CURRENCIES.filter(c=>c!=="TWD").map(c=>(
                    <div key={c} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                      <span style={{fontSize:"11px",color:"#786860",width:"36px"}}>{c}</span>
                      <input type="number" step="0.001" value={rates[c]??""} onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>0)setRates({...rates,[c]:v});}}
                        style={{...ipt,padding:"6px 8px",fontSize:"12px"}} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{display:"flex",gap:"10px",marginBottom:"20px",flexWrap:"wrap"}}>
          {[
            {label:"商品數量",value:`${stats.count} 件`,color:"#e8e0d0"},
            {label:"總成本",value:fmtTWD(stats.totalCost),color:"#e0c890"},
            {label:`總售價 ×${markup}`,value:fmtTWD(stats.totalSale),color:"#60c890"},
            {label:"總毛利",value:fmtTWD(stats.totalProfit),color:"#c890e0"},
          ].map(s=>(
            <div key={s.label} style={{flex:"1 1 120px",background:"#1a1820",border:"1px solid #2a2830",borderRadius:"8px",padding:"14px 16px"}}>
              <div style={{fontSize:"10px",color:"#786860",letterSpacing:"2px",marginBottom:"5px"}}>{s.label}</div>
              <div style={{fontSize:"17px",fontWeight:"700",color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm&&(
          <div style={{background:"#1a1820",border:"1px solid #3a3440",borderRadius:"8px",padding:"22px",marginBottom:"20px",animation:"fadeIn .2s"}}>
            <div style={{fontSize:"11px",color:"#a08060",letterSpacing:"2px",marginBottom:"16px"}}>{editId?"✏ 編輯商品":"✚ 新增商品"}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"14px"}}>
              <div style={{gridColumn:"span 2"}}>
                <label style={lbl}>商品名稱 *</label>
                <input name="name" placeholder="例：頸鏈、手錶…" value={form.name} onChange={handleChange} style={ipt} />
              </div>
              {[
                {amtKey:"basePrice",curKey:"baseCurrency",label:"進貨價 *"},
                {amtKey:"shipping",curKey:"shippingCurrency",label:"運費"},
                {amtKey:"serviceFee",curKey:"serviceFeeCurrency",label:"服務費"},
                {amtKey:"tax",curKey:"taxCurrency",label:"稅金"},
              ].map(f=>(
                <div key={f.amtKey}>
                  <label style={lbl}>{f.label}</label>
                  <div style={{display:"flex",gap:"6px"}}>
                    <CurrencySelect value={form[f.curKey]} onChange={v=>handleCur(f.curKey,v)} />
                    <input name={f.amtKey} type="number" placeholder="0" value={form[f.amtKey]} onChange={handleChange} style={{...ipt,flex:1}} />
                  </div>
                  {form[f.amtKey]>0 && form[f.curKey]!=="TWD" && (
                    <div style={{fontSize:"10px",color:"#786860",marginTop:"3px"}}>≈ {fmtTWD(toTWD(form[f.amtKey],form[f.curKey]))}</div>
                  )}
                </div>
              ))}
              <div>
                <label style={lbl}>備註</label>
                <input name="note" placeholder="供應商、平台…" value={form.note} onChange={handleChange} style={ipt} />
              </div>
              <div>
                <label style={lbl}>自訂售價（NT$）</label>
                <input name="customPrice" type="number" placeholder="留空則用 ×倍數" value={form.customPrice} onChange={handleChange}
                  style={{...ipt, borderColor: form.customPrice ? "#7060c0" : "#3a3440"}} />
                {form.customPrice && previewCost > 0 && (
                  <div style={{fontSize:"10px",marginTop:"3px"}}>
                    {(()=>{
                      const m=((Number(form.customPrice)-previewCost)/previewCost)*100;
                      const color=m>=0?"#c890e0":"#e07060";
                      return <span style={{color}}>{m>=0?"▲":"▼"} {m.toFixed(1)}%　利潤 {fmtTWD(Number(form.customPrice)-previewCost)}</span>;
                    })()}
                  </div>
                )}
              </div>
            </div>
            {form.basePrice&&(
              <div style={{marginTop:"14px",padding:"11px 14px",background:"#0f0e11",borderRadius:"6px",border:"1px solid #2a2830",display:"flex",gap:"18px",flexWrap:"wrap",fontSize:"12px"}}>
                <span style={{color:"#786860"}}>預覽</span>
                <span>成本：<strong style={{color:"#e0c890"}}>{fmtTWD(previewCost)}</strong></span>
                {form.customPrice ? (
                  <>
                    <span>自訂售價：<strong style={{color:"#a080e0"}}>{fmtTWD(Number(form.customPrice))}</strong></span>
                    {(()=>{ const m=((Number(form.customPrice)-previewCost)/previewCost)*100;
                      return <span style={{color:m>=0?"#c890e0":"#e07060"}}>利潤率：<strong>{m>=0?"▲":""}{m.toFixed(1)}%</strong></span>; })()}
                  </>
                ) : (
                  <>
                    <span>售價 ×{markup}：<strong style={{color:"#60c890"}}>{fmtTWD(previewCost*markup)}</strong></span>
                    <span>毛利：<strong style={{color:"#c890e0"}}>{fmtTWD(previewCost*(markup-1))}</strong>（{((markup-1)*100).toFixed(0)}%）</span>
                  </>
                )}
              </div>
            )}
            <div style={{display:"flex",gap:"8px",marginTop:"14px"}}>
              <button style={btn("linear-gradient(135deg,#c8934a,#e0b060)","#1a1408")} onClick={handleSubmit}>{editId?"儲存更改":"新增商品"}</button>
              <button style={btn("#2a2830","#786860")} onClick={handleCancel}>取消</button>
            </div>
          </div>
        )}

        {/* Search + Sort */}
        <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
          <input placeholder="搜尋商品名稱或備註…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{...ipt,flex:"1 1 180px",background:"#1a1820",border:"1px solid #2a2830"}} />
          <select value={sortKey} onChange={e=>setSortKey(e.target.value)}
            style={{background:"#1a1820",border:"1px solid #2a2830",borderRadius:"6px",padding:"8px 12px",color:"#a08060",fontSize:"12px",cursor:"pointer",outline:"none"}}>
            <option value="name">名稱排序</option>
            <option value="cost">成本排序</option>
            <option value="sale">售價排序</option>
            <option value="profit">毛利排序</option>
          </select>
        </div>

        {/* Table */}
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:"50px 20px",color:"#4a4450",border:"1px dashed #2a2830",borderRadius:"8px",fontSize:"13px"}}>
            尚無商品資料　點選「新增商品」開始建檔
          </div>
        ):(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead>
                <tr style={{borderBottom:"1px solid #2a2830"}}>
                  {["商品名稱","進貨價","運費","服務費","稅金","總成本(NT$)",`系統售價×${markup}`,"自訂售價","利潤率","利潤(NT$)","備註","操作"].map(h=>(
                    <th key={h} style={{padding:"9px 10px",textAlign:"left",color:"#786860",fontWeight:"400",fontSize:"10px",letterSpacing:"1px",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item,idx)=>{
                  const cost=itemCost(item),sale=salePrice(item);
                  const activePrice = item.customPrice ? Number(item.customPrice) : sale;
                  const margin = cost>0 ? ((activePrice-cost)/cost)*100 : 0;
                  const profitAmt = activePrice - cost;
                  return (
                    <tr key={item.id}
                      style={{borderBottom:"1px solid #1e1c24",background:idx%2===0?"transparent":"#141218",transition:"background .12s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#1e1c28"}
                      onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?"transparent":"#141218"}>
                      <td style={{padding:"10px 10px",fontWeight:"600",color:"#f0e8d8"}}>{item.name}</td>
                      {[
                        {amt:item.basePrice,cur:item.baseCurrency},
                        {amt:item.shipping,cur:item.shippingCurrency},
                        {amt:item.serviceFee,cur:item.serviceFeeCurrency},
                        {amt:item.tax,cur:item.taxCurrency},
                      ].map((f,i)=>(
                        <td key={i} style={{padding:"10px 10px",color:"#c0b8a8",whiteSpace:"nowrap"}}>
                          <div>{fmtOrig(f.amt,f.cur)}</div>
                          {f.cur!=="TWD"&&<div style={{fontSize:"10px",color:"#5a5460"}}>≈{fmtTWD(toTWD(f.amt,f.cur))}</div>}
                        </td>
                      ))}
                      <td style={{padding:"10px 10px",fontWeight:"700",color:"#e0c890",whiteSpace:"nowrap"}}>{fmtTWD(cost)}</td>
                      <td style={{padding:"10px 10px",fontWeight:"700",color:"#60c890",whiteSpace:"nowrap"}}>{fmtTWD(sale)}</td>
                      <td style={{padding:"10px 10px",whiteSpace:"nowrap"}}>
                        {item.customPrice ? <span style={{fontWeight:"700",color:"#a080e0"}}>{fmtTWD(item.customPrice)}</span>
                          : <span style={{color:"#4a4450",fontSize:"11px"}}>—</span>}
                      </td>
                      <td style={{padding:"10px 10px",whiteSpace:"nowrap"}}>
                        <span style={{fontWeight:"700",color:margin>=20?"#c890e0":margin>=0?"#a0c870":"#e07060"}}>
                          {margin>=0?"▲":"▼"} {Math.abs(margin).toFixed(1)}%
                          {item.customPrice&&<span style={{fontSize:"10px",color:"#786860",marginLeft:"4px"}}>(自訂)</span>}
                        </span>
                      </td>
                      <td style={{padding:"10px 10px",whiteSpace:"nowrap"}}>
                        <span style={{fontWeight:"700",color:profitAmt>=0?"#c890e0":"#e07060"}}>
                          {profitAmt>=0?"":"-"}{fmtTWD(Math.abs(profitAmt))}
                        </span>
                      </td>
                      <td style={{padding:"10px 10px",color:"#786860",fontSize:"11px"}}>{item.note||"—"}</td>
                      <td style={{padding:"10px 10px",whiteSpace:"nowrap"}}>
                        <button style={{...obtn("#a08060","#3a3440"),marginRight:"6px"}} onClick={()=>handleEdit(item)}>編輯</button>
                        <button style={obtn("#c06060","#4a2830")} onClick={()=>handleDelete(item.id)}>刪除</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;700&display=swap');
        * { box-sizing:border-box; }
        input::placeholder { color:#4a4450; }
        select option { background:#1a1820; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
