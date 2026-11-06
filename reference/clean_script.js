
const TEMPLATE1="UEsDBBQABgAIA... [BASE64 TRUNCATED] ...
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0),today=()=>{let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const stages=['Chờ trình ký','Đã trình ký','Đã phê duyệt','Đã đặt hàng','Đã nhận hàng','Hoàn tất','Từ chối'];
let db=JSON.parse(localStorage.getItem('qtts_test_db')||'[]'),counter=Number(localStorage.getItem('qtts_counter')||0),sourceRows=[],sourceHeaders=[],mapping={},parsed=[],parsedAll=[],sourceName='',currentId=null;
function save(){localStorage.setItem('qtts_test_db',JSON.stringify(db));localStorage.setItem('qtts_counter',counter);renderAll()}
function money(v){if(typeof v==='number')return v;let s=String(v??'').replace(/[^\d,.-]/g,'');if(s.includes('.')&&s.includes(','))s=s.replace(/\./g,'').replace(',','.');else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');else if(s.includes(',')&&!s.includes('.'))s=s.replace(',','.');let n=Number(s);return Number.isFinite(n)?n:0}
function norm(s){return String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim()}
function dateText(v){if(v===null||v===undefined||v==='')return '';if(typeof v==='number'){let d=new Date(Date.UTC(1899,11,30)+v*86400000);return d.toLocaleDateString('vi-VN')}let s=String(v).trim();let m=s.match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4})$/);if(m)return `${String(m[1]).padStart(2,'0')}/${String(m[2]).padStart(2,'0')}/${m[3]}`;let d=new Date(s);return isNaN(d)?s:d.toLocaleDateString('vi-VN')}
function poNext(){counter++;localStorage.setItem('qtts_counter',counter);return `PO-${new Date().getFullYear()}-${String(counter).padStart(5,'0')}`}
function go(view){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$(view).classList.add('active');document.querySelectorAll('.navbtn').forEach(x=>x.classList.toggle('active',x.dataset.view===view));renderAll()}
document.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>go(b.dataset.view));
function statusClass(s){if(s==='Từ chối')return 's-rejected';if(s==='Hoàn tất'||s==='Đã phê duyệt'||s==='Đã nhận hàng')return 's-approved';if(s==='Đã đặt hàng')return 's-order';return 's-pending'}
function total(p){return p.items.reduce((a,x)=>a+(Number(x.amount)||0),0)}
function qty(p){return p.items.reduce((a,x)=>a+(Number(x.qty)||0),0)}
function supplier(p){return [...new Set(p.items.map(x=>x.supplier).filter(Boolean))].join(', ')||'Chưa cập nhật'}
function statusTag(s){return `<span class="status ${statusClass(s)}">${s}</span>`}
function renderAll(){renderDash();renderPO();renderApproval();renderDelivery();renderReports()}
function renderDash(){$('kTotal').textContent=db.length;$('kPending').textContent=db.filter(p=>['Chờ trình ký','Đã trình ký'].includes(p.status)).length;$('kOrdering').textContent=db.filter(p=>p.status==='Đã đặt hàng').length;$('kDone').textContent=db.filter(p=>p.status==='Hoàn tất').length;$('recentRows').innerHTML=db.slice().sort((a,b)=>b.created.localeCompare(a.created)).slice(0,7).map(p=>`<tr><td><b>${p.po}</b></td><td>${dateText(p.date)}</td><td>${p.items.length}</td><td>${fmt(total(p))} đ</td><td>${statusTag(p.status)}</td><td><span class="link" onclick="openPO('${p.id}')">Chi tiết</span></td></tr>`).join('')||'<tr><td colspan="6" class="muted">Chưa có hồ sơ. Hãy upload bảng kê hoặc nạp dữ liệu mẫu.</td></tr>'}
function renderPO(){let q=norm($('searchPO')?.value||''),st=$('filterStatus')?.value||'';let arr=db.filter(p=>(!st||p.status===st)&&(!q||norm([p.po,p.requester,p.items.map(x=>x.unit+' '+x.item).join(' ')].join(' ')).includes(q)));$('poRows').innerHTML=arr.map(p=>`<tr><td><b>${p.po}</b></td><td>${dateText(p.date)}</td><td>${p.items[0]?.unit||'—'}</td><td>${p.items.length}</td><td>${fmt(total(p))} đ</td><td>${statusTag(p.status)}</td><td><span class="link" onclick="openPO('${p.id}')">Mở hồ sơ</span></td></tr>`).join('')||'<tr><td colspan="7" class="muted">Không có hồ sơ phù hợp.</td></tr>'}
function renderApproval(){$('approvalRows').innerHTML=db.filter(p=>!['Hoàn tất','Từ chối','Đã đặt hàng','Đã nhận hàng'].includes(p.status)).map(p=>`<tr><td><b>${p.po}</b></td><td>${p.requester||'—'}</td><td>${fmt(total(p))} đ</td><td>${statusTag(p.status)}</td><td><span class="link" onclick="openPO('${p.id}')">Xử lý</span></td></tr>`).join('')||'<tr><td colspan="5" class="muted">Không có hồ sơ chờ xử lý.</td></tr>'}
function renderDelivery(){$('deliveryRows').innerHTML=db.filter(p=>['Đã phê duyệt','Đã đặt hàng','Đã nhận hàng','Hoàn tất'].includes(p.status)).map(p=>`<tr><td><b>${p.po}</b></td><td>${p.orderSupplier||supplier(p)}</td><td>${fmt(total(p))} đ</td><td>${p.orderDate?dateText(p.orderDate):'—'}</td><td>${qty(p)}</td><td>${p.receivedQty||0}</td><td>${statusTag(p.status)}</td><td><span class="link" onclick="openPO('${p.id}')">Cập nhật</span></td></tr>`).join('')||'<tr><td colspan="8" class="muted">Chưa có hồ sơ được phê duyệt để đặt hàng.</td></tr>'}
function renderReports(){let v=db.reduce((a,p)=>a+total(p),0),lines=db.reduce((a,p)=>a+p.items.length,0),q=db.reduce((a,p)=>a+qty(p),0),sup=new Set(db.flatMap(p=>p.items.map(x=>x.supplier).filter(Boolean)));$('rValue').textContent=fmt(v)+' đ';$('rLines').textContent=lines;$('rQty').textContent=fmt(q);$('rSuppliers').textContent=sup.size;let max=Math.max(1,...stages.map(s=>db.filter(p=>p.status===s).length));$('statusBars').innerHTML=stages.map(s=>{let n=db.filter(p=>p.status===s).length;return `<div style="margin:12px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span>${s}</span><b>${n}</b></div><div class="bar"><span style="width:${n/max*100}%"></span></div></div>`}).join('')}
function openPO(id){let p=db.find(x=>x.id===id);if(!p)return;currentId=id;$('modalTitle').textContent='Hồ sơ '+p.po;let idx=stages.indexOf(p.status);$('modalBody').innerHTML=`
<div class="grid"><div><div class="small muted">Ngày tạo</div><b>${dateText(p.date)}</b></div><div><div class="small muted">Người đề xuất</div><b>${p.requester||'Chưa nhập'}</b></div><div><div class="small muted">Tổng giá trị chưa VAT</div><b>${fmt(total(p))} đ</b></div></div>
<div class="timeline">${stages.slice(0,6).map((s,i)=>`<i class="${idx>=i&&p.status!=='Từ chối'?'done':''}"></i>`).join('')}</div><p>${statusTag(p.status)} <span class="small muted"> · Cập nhật gần nhất: ${p.updated||'—'}</span></p>
<div class="tablewrap"><table><thead><tr><th>STT</th><th>Đơn vị</th><th>Nội dung</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${p.items.map((x,i)=>`<tr><td>${i+1}</td><td>${x.unit||''}</td><td>${x.item}<div class='small muted'>MSP: ${x.msp||'—'} · TT ĐVKD: ${x.statusDV||'—'} · TT Hội sở: ${x.statusHO||'—'}</div></td><td>${x.qty}</td><td>${fmt(x.price)}</td><td>${fmt(x.amount)}</td></tr>`).join('')}</tbody></table></div>
<div class="grid" style="margin-top:14px"><div class="field"><label>Nhà cung cấp / NCC đặt hàng</label><input id="editSupplier" value="${(p.orderSupplier||supplier(p)).replace(/"/g,'&quot;')}"></div><div class="field"><label>Số đơn đặt hàng</label><input id="editOrderNo" value="${p.orderNo||''}" placeholder="Số PO NCC / đơn đặt hàng"></div><div class="field"><label>Ngày đặt hàng</label><input id="editOrderDate" type="date" value="${p.orderDate||''}"></div><div class="field"><label>Số lượng đã nhận</label><input id="editReceived" type="number" min="0" value="${p.receivedQty||0}"></div><div class="field"><label>Ghi chú xử lý</label><input id="editNote" value="${(p.note||'').replace(/"/g,'&quot;')}" placeholder="Nhập ghi chú"></div></div>
<div class="actions">
${p.status==='Chờ trình ký'?`<button class="btn primary" onclick="changeStatus('Đã trình ký')">Gửi trình ký</button>`:''}
${p.status==='Đã trình ký'?`<button class="btn good" onclick="changeStatus('Đã phê duyệt')">Phê duyệt</button><button class="btn danger" onclick="changeStatus('Từ chối')">Từ chối</button>`:''}
${p.status==='Đã phê duyệt'?`<button class="btn primary" onclick="saveOrder()">Lưu thông tin đặt hàng & chuyển trạng thái</button>`:''}
${p.status==='Đã đặt hàng'?`<button class="btn good" onclick="receiveOrder()">Xác nhận nhận hàng</button>`:''}
${p.status==='Đã nhận hàng'?`<button class="btn good" onclick="changeStatus('Hoàn tất')">Hoàn tất hồ sơ</button>`:''}
<button class="btn soft" onclick="exportPO('${p.id}')">Xuất lại 2 file Excel</button><button class="btn soft" onclick="saveEdits()">Lưu ghi chú</button></div>
<div class="notice">Lịch sử: ${(p.logs||[]).map(l=>`${l.time} – ${l.text}`).join('<br>')||'Chưa có lịch sử'}</div>`;
$('modalBg').classList.add('show')}
function closeModal(){$('modalBg').classList.remove('show')}
function log(p,text){p.logs=p.logs||[];p.logs.unshift({time:new Date().toLocaleString('vi-VN'),text});p.updated=new Date().toLocaleString('vi-VN')}
function changeStatus(s){let p=db.find(x=>x.id===currentId);if(!p)return;if(s==='Từ chối'&&!confirm('Anh xác nhận từ chối hồ sơ này?'))return;p.status=s;log(p,'Chuyển trạng thái: '+s);save();openPO(p.id)}
function saveEdits(){let p=db.find(x=>x.id===currentId);if(!p)return;p.note=$('editNote').value;log(p,'Cập nhật ghi chú');save();openPO(p.id)}
function saveOrder(){let p=db.find(x=>x.id===currentId);p.orderSupplier=$('editSupplier').value;p.orderNo=$('editOrderNo').value;p.orderDate=$('editOrderDate').value||today();p.note=$('editNote').value;p.status='Đã đặt hàng';log(p,'Đã cập nhật thông tin đặt hàng');save();openPO(p.id)}
function receiveOrder(){let p=db.find(x=>x.id===currentId);let n=Number($('editReceived').value||0);if(n<0||n>qty(p)){alert('Số lượng nhận phải từ 0 đến số lượng đặt.');return}if(n<qty(p)){alert('Số lượng nhận chưa đủ. Bản test hiện yêu cầu nhận đủ mới chuyển bước.');return}p.receivedQty=n;p.note=$('editNote').value;p.status='Đã nhận hàng';log(p,'Đã xác nhận nhận đủ hàng');save();openPO(p.id)}
function downloadBlob(blob,name){let a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
async function exportPO(id){
 let p=db.find(x=>x.id===id);if(!p)return;
 try{
  let wb1=new ExcelJS.Workbook();
  await wb1.xlsx.load(await fetch('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+TEMPLATE1).then(r=>r.arrayBuffer()));
  let s1=wb1.worksheets[0];
  let d=new Date((p.date||today())+'T00:00:00');
  s1.getCell('F5').value=`Tp. Hồ Chí Minh, ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()}`;
  s1.getCell('A11').value=1;
  s1.getCell('B11').value=`Các tài sản cố định/Công cụ lao động theo bảng kê số: ${p.po} (Đính kèm bảng kê chi tiết)`;
  s1.getCell('C11').value='-';s1.getCell('D11').value='-';s1.getCell('E11').value=qty(p);
  s1.getCell('F11').value=total(p);s1.getCell('F11').numFmt='#,##0';
  s1.getCell('G11').value=supplier(p);
  s1.getCell('H11').value=[...new Set(p.items.map(x=>x.purpose).filter(Boolean))].join('; ')||'Theo đề xuất của đơn vị';
  s1.getRow(11).height=58;

  let wb2=new ExcelJS.Workbook();
  await wb2.xlsx.load(await fetch('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+TEMPLATE2).then(r=>r.arrayBuffer()));
  let s2=wb2.worksheets[0];
  s2.getCell('A4').value=p.po;
  s2.getCell('J4').value=`Tp.HCM, Ngày ${d.getDate()} tháng ${d.getMonth()+1} năm ${d.getFullYear()}`;

  // Mẫu có sẵn một dòng trống cho từng nhóm. Dùng dòng trống đó cho dòng đầu,
  // chỉ chèn thêm các dòng còn thiếu; dịch chuyển vùng gộp để không vỡ phần tổng cộng/chữ ký.
  const isA=p.payGroup==='A';
  const firstDataRow=isA?9:11;
  const insertAt=firstDataRow+1;
  const items=p.items||[];
  const extra=Math.max(0,items.length-1);
  const merges=[...(s2.model.merges||[])];
  merges.forEach(r=>{try{s2.unMergeCells(r)}catch(e){}});
  if(extra>0)s2.spliceRows(insertAt,0,...Array.from({length:extra},()=>Array(10).fill(null)));
  const shiftRow=n=>n>=insertAt?n+extra:n;
  merges.forEach(ref=>{
   const m=ref.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
   if(!m)return;
   const r1=shiftRow(Number(m[2])),r2=shiftRow(Number(m[4]));
   s2.mergeCells(`${m[1]}${r1}:${m[3]}${r2}`);
  });

  items.forEach((x,i)=>{
   const rn=firstDataRow+i;
   const row=s2.getRow(rn);
   const sourceRow=s2.getRow(firstDataRow);
   const vals=[i+1,x.date||'',x.unit||'',x.supplier||'',x.item||'',Number(x.qty||0),x.spec||'',Number(x.price||0),Number(x.amount||0),x.purpose||''];
   for(let c=1;c<=10;c++){
    const cell=row.getCell(c),src=sourceRow.getCell(c);
    cell.value=vals[c-1];
    if(src.style)cell.style=JSON.parse(JSON.stringify(src.style));
    cell.alignment={...(cell.alignment||{}),vertical:'middle',wrapText:true};
    if([6,8,9].includes(c))cell.numFmt='#,##0';
   }
   row.height=32;
  });
  const totalRow=12+extra;
  s2.getCell('A'+totalRow).value='TỔNG CỘNG CHƯA BAO GỒM VAT:';
  s2.getCell('I'+totalRow).value=total(p);
  s2.getCell('I'+totalRow).numFmt='#,##0';
  s2.getCell('I'+totalRow).alignment={...(s2.getCell('I'+totalRow).alignment||{}),horizontal:'center',vertical:'middle'};

  const b1=await wb1.xlsx.writeBuffer(),b2=await wb2.xlsx.writeBuffer();
  downloadBlob(new Blob([b1]),p.po+'_01_Phieu_yeu_cau.xlsx');
  downloadBlob(new Blob([b2]),p.po+'_02_Bang_ke.xlsx');
 }catch(e){console.error(e);alert('Lỗi xuất Excel: '+e.message)}
}
function openPOandClose(id){closeModal();openPO(id)}
const defs=[
['date','Ngày đề xuất',['ngay de xuat','ngay','date']],
['unit','Tên đơn vị',['ten don vi','don vi','chi nhanh']],
['supplier','Nhà cung cấp',['nha cung cap','ncc','vendor']],
['item','Nội dung / Tên hàng hóa',['noi dung','ten hang hoa','ten tai san','hang hoa','san pham']],
['qty','Số lượng',['sl','so luong','quantity']],
['spec','Quy cách',['quy cach','model','cau hinh','dvt']],
['price','Đơn giá chưa VAT',['don gia','don gia chua vat','gia']],
['amount','Thành tiền chưa VAT',['thanh tien','tong tien','amount']],
['purpose','Mục đích sử dụng',['muc dich su dung','muc dich','ly do']],
['msp','Mã phiếu gốc (MSP)',['msp','ma phieu','ma yeu cau']],
['unitCode','Mã đơn vị',['ma dv','ma don vi','unit code']],
['address','Địa chỉ đơn vị',['dia chi','address']],
['requestType','Loại yêu cầu',['loai yc','loai_yc','loai yeu cau']],
['statusDV','Trạng thái đơn vị (TT_DVKD)',['tt dvkd','tt_dvkd','trang thai don vi']],
['statusHO','Trạng thái Hội sở (TT_HO)',['tt ho','tt_ho','trang thai hoi so']],
['itNote','Ý kiến IT',['it note','it_note']],
['itManagerNote','Ý kiến quản lý IT',['it mngr note','it_mngr_note']],
['userInput','User nhập',['user nhap','user_nhap']],
['userApprove','User duyệt',['user duyet','user_duyet']]
];
$('sourceFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;sourceName=f.name;$('fileName').textContent=f.name;try{let wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});let hi=rows.findIndex(r=>r.filter(v=>String(v).trim()).length>=2);if(hi<0)throw Error('Không tìm thấy dòng tiêu đề');sourceHeaders=rows[hi].map((v,i)=>String(v||`Cột ${i+1}`));sourceRows=rows.slice(hi+1).filter(r=>r.some(v=>String(v??'').trim()!==''));mapping={};defs.forEach(([k,l,aliases])=>{let ix=sourceHeaders.findIndex(h=>aliases.some(a=>norm(h).includes(norm(a))));mapping[k]=ix>=0?String(ix):''});$('previewPanel').classList.add('hidden')}catch(err){alert('Không đọc được file: '+err.message)}};
function renderMapping(){$('mapFields').innerHTML=defs.map(([k,l])=>`<div class="field"><label>${l}${['item','qty'].includes(k)?' *':''}</label><select data-key="${k}"><option value="">— Không chọn —</option>${sourceHeaders.map((h,i)=>`<option value="${i}" ${mapping[k]===String(i)?'selected':''}>${h}</option>`).join('')}</select></div>`).join('');document.querySelectorAll('[data-key]').forEach(el=>el.onchange=()=>mapping[el.dataset.key]=el.value)}
function val(row,k){return mapping[k]===''?'':row[Number(mapping[k])]??''}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function selectedParsed(){return parsed.filter(x=>x.selected!==false)}
function updateParsed(i,k,v){let x=parsed[i];if(!x)return;if(['qty','price','amount'].includes(k))x[k]=money(v);else x[k]=v;if(k==='qty'||k==='price'){x.amount=(Number(x.qty)||0)*(Number(x.price)||0)}buildParsed()}
function toggleParsed(i,on){if(parsed[i])parsed[i].selected=!!on;updateSelectionSummary()}
function updateSelectionSummary(){let n=selectedParsed().length;let el=$('selectionSummary');if(el)el.textContent=`Đang chọn ${n}/${parsed.length} dòng · Tổng chưa VAT: ${fmt(selectedParsed().reduce((a,x)=>a+(Number(x.amount)||0),0))} đồng`;}
function buildParsed(){
parsed=parsedAll.filter(x=>$('cancelFilter').value==='include'||(norm(x.statusDV)!=='da huy'&&norm(x.statusHO)!=='da huy'));
parsed.forEach(x=>{if(x.selected===undefined)x.selected=true});
const inp=(i,k,v,type='text',cls='')=>`<input class="cell-edit ${cls}" type="${type}" value="${esc(v)}" onchange="updateParsed(${i},'${k}',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
$('previewRows').innerHTML=parsed.map((x,i)=>`<tr><td><input type="checkbox" ${x.selected!==false?'checked':''} onchange="toggleParsed(${i},this.checked)"></td><td>${i+1}</td><td>${inp(i,'date',x.date)}</td><td>${inp(i,'unit',x.unit)}</td><td>${inp(i,'supplier',x.supplier)}</td><td>${inp(i,'item',x.item)}</td><td>${inp(i,'qty',x.qty,'number')}</td><td>${inp(i,'spec',x.spec)}</td><td>${inp(i,'price',x.price,'number')}</td><td>${inp(i,'amount',x.amount,'number')}</td><td>${inp(i,'purpose',x.purpose)}</td></tr>`).join('');
let cancelled=parsedAll.length-parsed.length;
let warnings=[];parsed.forEach((x,i)=>{if(!x.qty)warnings.push(`Dòng ${i+1} thiếu số lượng`);if(!x.amount)warnings.push(`Dòng ${i+1} chưa có thành tiền`);if(!x.unit)warnings.push(`Dòng ${i+1} thiếu đơn vị`)});
$('previewSummary').textContent=`Nguồn: ${sourceName} · Đọc được ${parsedAll.length} dòng · Hiển thị ${parsed.length} dòng · Tổng chưa VAT: ${fmt(parsed.reduce((a,x)=>a+(Number(x.amount)||0),0))} đồng · ${cancelled} dòng bị loại theo bộ lọc trạng thái`;
$('validation').textContent=(warnings.length?'Cần rà soát: '+warnings.slice(0,10).join(' · '):'Đã nhận diện dữ liệu cơ bản. Anh có thể sửa trực tiếp từng ô và tick chọn các dòng cần xuất.')+(cancelled?` Có ${cancelled} dòng có trạng thái “Đã hủy” đang được loại khỏi hồ sơ.`:'');
updateSelectionSummary();
}
$('readBtn').onclick=()=>{
if(mapping.item===''||mapping.qty===''){alert('Chọn cột Nội dung và Số lượng trước.');return}
parsedAll=sourceRows.map(r=>{let q=money(val(r,'qty')),price=money(val(r,'price')),amount=money(val(r,'amount'));return {
date:dateText(val(r,'date')),unit:String(val(r,'unit')||''),supplier:String(val(r,'supplier')||''),item:String(val(r,'item')||'').trim(),qty:q,spec:String(val(r,'spec')||''),price,amount:amount||q*price,purpose:String(val(r,'purpose')||''),selected:true,
msp:String(val(r,'msp')||''),unitCode:String(val(r,'unitCode')||''),address:String(val(r,'address')||''),requestType:String(val(r,'requestType')||''),statusDV:String(val(r,'statusDV')||''),statusHO:String(val(r,'statusHO')||''),itNote:String(val(r,'itNote')||''),itManagerNote:String(val(r,'itManagerNote')||''),userInput:String(val(r,'userInput')||''),userApprove:String(val(r,'userApprove')||'')
}}).filter(x=>x.item);
if(!parsedAll.length){alert('Không tìm thấy dòng hàng hóa hợp lệ.');return}
if(!$('cancelFilter'))return;
buildParsed();
if(!parsed.length){alert('Không còn dòng nào sau khi áp dụng bộ lọc. Hãy chọn giữ lại tất cả nếu cần.');return}
let po=poNext();$('newPO').value=po;$('newDate').value=today();
$('previewPanel').classList.remove('hidden');$('previewPanel').scrollIntoView({behavior:'smooth'});
};
$('cancelFilter').onchange=()=>{if(parsedAll.length)buildParsed()};
$('selectAllRows').onclick=()=>{parsed.forEach(x=>x.selected=true);buildParsed()};$('clearAllRows').onclick=()=>{parsed.forEach(x=>x.selected=false);buildParsed()};
$('clearFile').onclick=()=>{$('sourceFile').value='';$('fileName').textContent='Kéo thả hoặc nhấn để chọn file Excel';sourceRows=[];sourceHeaders=[];mapping={};parsed=[];parsedAll=[];$('previewPanel').classList.add('hidden')};
$('createPO').onclick=()=>{let chosen=selectedParsed().map(x=>({...x}));if(!chosen.length){alert('Anh chưa tick chọn dòng nào để xuất phiếu.');return}let p={id:'id'+Date.now()+Math.random().toString(16).slice(2,6),po:$('newPO').value,date:$('newDate').value||today(),requester:$('requester').value,note:$('newNote').value,payGroup:$('payGroup').value,source:sourceName,items:chosen,status:'Chờ trình ký',created:new Date().toISOString(),updated:new Date().toLocaleString('vi-VN'),receivedQty:0,logs:[]};log(p,'Tạo hồ sơ từ bảng kê: '+sourceName);db.unshift(p);save();alert('Đã tạo hồ sơ '+p.po+' từ '+chosen.length+' dòng đã chọn. Hệ thống sẽ xuất 2 file Excel.');exportPO(p.id);$('sourceFile').value='';$('previewPanel').classList.add('hidden');go('pos');openPO(p.id)};
$('searchPO').oninput=renderPO;$('filterStatus').onchange=renderPO;
$('exportCSV').onclick=()=>{let rows=[['Mã PO','Ngày','Người đề xuất','Số dòng','Tổng tiền chưa VAT','Trạng thái','Nhà cung cấp'],...db.map(p=>[p.po,p.date,p.requester,p.items.length,total(p),p.status,supplier(p)])];let csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),'Bao_cao_QTTS.csv')};
$('seedDemo').onclick=()=>{if(db.length&&!confirm('Đã có dữ liệu. Nạp thêm 3 hồ sơ mẫu?'))return;let samples=[['Chờ trình ký','CN Nhà Bè','Máy tính Dell OptiPlex','Dell',12,18500000],['Đã trình ký','CN Thuận An','Máy lạnh 2HP','Daikin',4,22500000],['Đã đặt hàng','Hội sở','Máy in laser','Brother',8,6200000]];samples.forEach((s,i)=>{let p={id:'demo'+Date.now()+i,po:poNext(),date:today(),requester:'Nguyễn Văn A',note:'Hồ sơ dữ liệu mẫu',payGroup:'B',source:'Dữ liệu mẫu hệ thống',items:[{date:today(),unit:s[1],supplier:s[3],item:s[2],qty:s[4],spec:'Theo cấu hình đề xuất',price:s[5],amount:s[4]*s[5],purpose:'Phục vụ hoạt động đơn vị'}],status:s[0],created:new Date().toISOString(),updated:new Date().toLocaleString('vi-VN'),receivedQty:s[0]==='Đã đặt hàng'?0:0,orderDate:s[0]==='Đã đặt hàng'?today():'',orderSupplier:s[3],logs:[]};log(p,'Nạp hồ sơ mẫu');db.unshift(p)});save();$('settingsMsg').textContent='Đã nạp 3 hồ sơ mẫu để anh thử quy trình.'};
$('clearAll').onclick=()=>{if(!confirm('Xóa toàn bộ hồ sơ test trong trình duyệt này?'))return;db=[];counter=0;save();$('settingsMsg').textContent='Đã xóa dữ liệu test.'};
$('exportBackup').onclick=()=>downloadBlob(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),'QTTS_backup.json');
renderAll();
