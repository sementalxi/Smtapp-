const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let state = null;
let modalSubmit = null;

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401 && path !== '/api/admin/login') { showLogin(); throw new Error('Please log in again.'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(message, error = false) {
  const el = $('#toast'); el.textContent = message; el.classList.toggle('error', error); el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function showLogin(){ $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function showApp(){ $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); }

async function loadState(){ state = await api('/api/admin/state'); showApp(); renderAll(); }

function renderAll(){
  $('#serverName').textContent = state.server.name; $('#botTag').textContent = state.bot.tag;
  $('#statDepartments').textContent = state.summary.departments; $('#statOpen').textContent = state.summary.openTickets; $('#statClosed').textContent = state.summary.closedTickets; $('#statCommands').textContent = state.summary.customCommands;
  $('#panelTitle').value = state.settings.ticketPanelTitle; $('#panelText').value = state.settings.ticketPanelText; $('#panelFooter').value = state.settings.ticketPanelFooter; $('#panelColor').value = state.settings.ticketPanelColor || '#FF2D8B';
  $('#createdReply').value = state.settings.ticketCreatedReplyTemplate; $('#commandPrefix').value = state.settings.ticketCommandPrefix; $('#ticketEnabled').checked = state.settings.enabled;
  fillSelect($('#transcriptChannel'), state.textChannels, state.settings.ticketTranscriptChannelId, 'None'); fillSelect($('#publishChannel'), state.textChannels, '', 'Choose a channel'); fillSelect($('#archiveCategory'), state.categories, state.settings.ticketClosedCategoryId, 'None');
  renderPreview('#panelPreview'); renderPreview('#miniPreview'); renderDepartments(); renderCommands(); renderTickets();
}
function fillSelect(el, items, selected, blank){ el.innerHTML = `<option value="">${esc(blank)}</option>` + items.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${esc(x.category?x.category+' / ':'')}${esc(x.name)}</option>`).join(''); }
function renderPreview(sel){
  const e=$(sel), buttons=state.departments.slice(0,25).map(d=>`<span>${esc(d.emoji?d.emoji+' ':'')}${esc(d.label)}</span>`).join('');
  e.style.borderLeftColor = state.settings.ticketPanelColor || '#FF2D8B';
  e.innerHTML = `${state.settings.logoUrl?`<img class="preview-logo" src="${esc(state.settings.logoUrl)}?x=${Date.now()}"/>`:''}<div class="preview-title">${esc($('#panelTitle')?.value || state.settings.ticketPanelTitle)}</div><div class="preview-description">${esc($('#panelText')?.value || state.settings.ticketPanelText)}</div>${state.settings.bannerUrl?`<img class="preview-banner" src="${esc(state.settings.bannerUrl)}?x=${Date.now()}"/>`:''}<div class="preview-buttons">${buttons||'<span>Support</span>'}</div><div class="preview-footer">${esc($('#panelFooter')?.value || state.settings.ticketPanelFooter)}</div>`;
}
function renderDepartments(){
  const el=$('#departmentList');
  el.innerHTML = state.departments.map(d=>{const cat=state.categories.find(x=>x.id===d.categoryId)?.name||'No category'; const role=state.roles.find(x=>x.id===d.staffRoleId)?.name||'Inherited staff access'; return `<div class="list-card"><div><h3>${esc(d.emoji?d.emoji+' ':'')}${esc(d.label)}</h3><p>${esc(cat)} • ${esc(role)} • ${esc((d.questions||[]).length)} intake questions</p></div><div class="actions"><button onclick="editDepartment('${d.id}')">Edit</button><button class="danger-outline" onclick="deleteDepartment('${d.id}')">Delete</button></div></div>`}).join('') || '<div class="card muted">No departments yet.</div>';
}
function renderCommands(){
  const p=state.settings.ticketCommandPrefix||'!'; const el=$('#commandList');
  el.innerHTML = state.customCommands.map(c=>`<div class="list-card"><div><h3><code>${esc(p+c.trigger)}</code> ${esc(c.title||'')}</h3><p>${esc(c.message.slice(0,150))}${c.message.length>150?'…':''}</p></div><div class="actions"><button onclick="editCommand('${c.id}')">Edit</button><button class="danger-outline" onclick="deleteCommand('${c.id}')">Delete</button></div></div>`).join('') || '<div class="card muted">No custom commands yet.</div>';
}
function renderTickets(){
  const q=($('#ticketSearch')?.value||'').toLowerCase();
  const list=state.tickets.filter(t=>(`${t.number} ${t.ownerName} ${t.typeLabel} ${t.channelName}`.toLowerCase().includes(q)));
  $('#ticketsTable').innerHTML = `<table class="ticket-table"><thead><tr><th>#</th><th>Member</th><th>Department</th><th>Channel</th><th>Actions</th></tr></thead><tbody>${list.map(t=>`<tr><td>${String(t.number||0).padStart(4,'0')}</td><td>${esc(t.ownerName)}</td><td>${esc(t.typeLabel||t.typeId)}</td><td>${esc(t.channelName||t.channelId)}</td><td>${t.status==='open'?`<button onclick="sendTicketCommand('${t.channelId}')">Send Command</button> <button onclick="addTicketNote('${t.channelId}')">Add Note</button>`:'—'}</td></tr>`).join('')}</tbody></table>`;
}

function openModal(title, html, onSubmit){ $('#modalTitle').textContent=title; $('#modalBody').innerHTML=html; modalSubmit=onSubmit; $('#modal').classList.remove('hidden'); }
function closeModal(){ $('#modal').classList.add('hidden'); modalSubmit=null; }
function optionList(items, selected='', blank='None'){return `<option value="">${esc(blank)}</option>`+items.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${esc(x.name)}</option>`).join('')}
function deptForm(d={}){return `<label>Name<input name="label" maxlength="80" value="${esc(d.label||'')}" required></label><div class="row2"><label>Emoji<input name="emoji" maxlength="40" value="${esc(d.emoji||'')}" placeholder="🎫"></label><label>Button color<select name="style"><option ${d.style==='primary'?'selected':''}>primary</option><option ${d.style==='secondary'||!d.style?'selected':''}>secondary</option><option ${d.style==='success'?'selected':''}>success</option><option ${d.style==='danger'?'selected':''}>danger</option></select></label></div><label>Opening message<textarea name="intro" rows="4">${esc(d.intro||'Tell us what you need help with. You can upload screenshots or other files here.')}</textarea></label><label>Form questions — one per line, max 4<textarea name="questions" rows="4">${esc((d.questions||[]).join('\n'))}</textarea></label><label>Destination category<select name="categoryId">${optionList(state.categories,d.categoryId,'Choose category')}</select></label><label>Department staff role<select name="staffRoleId">${optionList(state.roles,d.staffRoleId,'Use category permissions')}</select></label>`}
function commandForm(c={}){return `<label>Command name<input name="trigger" maxlength="32" value="${esc(c.trigger||'')}" placeholder="payment" required></label><label>Embed title<input name="title" maxlength="256" value="${esc(c.title||'')}"></label><label>Response<textarea name="message" rows="7" maxlength="4000" required>${esc(c.message||'Hello {user},\n\n')}</textarea></label><div class="row2"><label>Color<input name="color" type="color" value="${esc(c.color||'#FF2D8B')}"></label><label>Footer<input name="footer" maxlength="200" value="${esc(c.footer||'')}"></label></div>`}

window.editDepartment = id => { const d=state.departments.find(x=>x.id===id); openModal('Edit Department',deptForm(d),async form=>{await api(`/api/admin/departments/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(form)))}); await loadState(); toast('Department updated.');}); };
window.deleteDepartment = async id => { if(!confirm('Delete this department button? Existing tickets are not deleted.'))return; try{await api(`/api/admin/departments/${encodeURIComponent(id)}`,{method:'DELETE'});await loadState();toast('Department deleted.')}catch(e){toast(e.message,true)}};
window.editCommand = id => { const c=state.customCommands.find(x=>x.id===id); openModal('Edit Custom Command',commandForm(c),async form=>{await api(`/api/admin/custom-commands/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(form)))});await loadState();toast('Command updated.');}); };
window.deleteCommand = async id => { if(!confirm('Delete this custom command?'))return;try{await api(`/api/admin/custom-commands/${encodeURIComponent(id)}`,{method:'DELETE'});await loadState();toast('Command deleted.')}catch(e){toast(e.message,true)}};
window.sendTicketCommand = id => { if(!state.customCommands.length)return toast('Create a custom command first.',true); openModal('Send Custom Command',`<label>Saved command<select name="commandId">${state.customCommands.map(c=>`<option value="${c.id}">${esc(state.settings.ticketCommandPrefix+c.trigger)} — ${esc(c.title||c.trigger)}</option>`).join('')}</select></label><label>Optional {args}<input name="args" maxlength="500"></label>`,async form=>{await api(`/api/admin/tickets/${encodeURIComponent(id)}/send-command`,{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});toast('Command sent and ticket owner tagged.');}); };
window.addTicketNote = id => openModal('Add Private Staff Note',`<label>Note<textarea name="text" rows="6" maxlength="1500" required></textarea></label>`,async form=>{await api(`/api/admin/tickets/${encodeURIComponent(id)}/note`,{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});toast('Private note saved.');});

$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#loginPassword').value})});await loadState()}catch(err){$('#loginError').textContent=err.message}});
$('#logoutBtn').addEventListener('click',async()=>{await api('/api/admin/logout',{method:'POST'}).catch(()=>{});showLogin()});
$$('#nav button').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.page)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.go)));
function goPage(name){$$('.page').forEach(p=>p.classList.remove('active-page'));$(`#page-${name}`).classList.add('active-page');$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===name));$('#pageTitle').textContent=$(`#page-${name} h1`)?.textContent||'Dashboard';if(name==='permissions')loadPermissions();}
$('#modalClose').onclick=closeModal;$('#modalCancel').onclick=closeModal;$('#modalForm').addEventListener('submit',async e=>{e.preventDefault();if(!modalSubmit)return;try{await modalSubmit(e.target);closeModal()}catch(err){toast(err.message,true)}});
$('#addDepartment').onclick=()=>openModal('Add Department',deptForm(),async form=>{await api('/api/admin/departments',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});await loadState();toast('Department added.');});
$('#addCommand').onclick=()=>openModal('New Custom Command',commandForm(),async form=>{await api('/api/admin/custom-commands',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});await loadState();toast('Custom command created.');});
$('#saveBranding').onclick=()=>saveSettingsFromPage('Branding saved.');$('#saveSettings').onclick=()=>saveSettingsFromPage('Ticket settings saved.');
async function saveSettingsFromPage(msg){try{await api('/api/admin/settings',{method:'PUT',body:JSON.stringify({enabled:$('#ticketEnabled').checked,ticketPanelTitle:$('#panelTitle').value,ticketPanelText:$('#panelText').value,ticketPanelFooter:$('#panelFooter').value,ticketPanelColor:$('#panelColor').value,ticketCreatedReplyTemplate:$('#createdReply').value,ticketCommandPrefix:$('#commandPrefix').value,ticketTranscriptChannelId:$('#transcriptChannel').value,ticketClosedCategoryId:$('#archiveCategory').value})});await loadState();toast(msg)}catch(e){toast(e.message,true)}}
$('#savePrefix').onclick=()=>saveSettingsFromPage('Command prefix saved.');
['panelTitle','panelText','panelFooter','panelColor'].forEach(id=>$('#'+id).addEventListener('input',()=>{if(state)renderPreview('#panelPreview')}));
async function upload(kind,file){if(!file)return; if(file.size>10*1024*1024)return toast('Image must be under 10 MB.',true);const reader=new FileReader();reader.onload=async()=>{try{await api('/api/admin/assets',{method:'POST',body:JSON.stringify({kind,dataUrl:reader.result})});await loadState();toast(`${kind} uploaded.`)}catch(e){toast(e.message,true)}};reader.readAsDataURL(file)}
$('#logoUpload').onchange=e=>upload('logo',e.target.files[0]);$('#bannerUpload').onchange=e=>upload('banner',e.target.files[0]);
$('#clearLogo').onclick=async()=>{await api('/api/admin/assets?kind=logo',{method:'DELETE'});await loadState();toast('Logo cleared.')};$('#clearBanner').onclick=async()=>{await api('/api/admin/assets?kind=banner',{method:'DELETE'});await loadState();toast('Banner cleared.')};
$('#publishPanel').onclick=async()=>{const channelId=$('#publishChannel').value;if(!channelId)return toast('Choose a publish channel.',true);try{await api('/api/admin/publish-panel',{method:'POST',body:JSON.stringify({channelId})});$('#publishResult').textContent='✅ Ticket panel published successfully.';toast('Ticket panel published.')}catch(e){toast(e.message,true)}};
$('#ticketSearch').addEventListener('input',renderTickets);$('#refreshTickets').onclick=()=>loadState().catch(e=>toast(e.message,true));
$('#checkPermissions').onclick=loadPermissions;async function loadPermissions(){try{const p=await api('/api/admin/permissions');$('#permissionResults').innerHTML=`<div class="card"><h3>Bot Permissions</h3>${p.checks.map(x=>`<div class="perm ${x.ok?'ok':'bad'}"><span>${esc(x.label)}</span><b>${x.ok?'✓ Ready':'✕ Missing'}</b></div>`).join('')}</div><div class="card"><h3>Department Categories</h3>${p.departments.map(x=>`<div class="perm ${x.ok?'ok':'bad'}"><span>${esc(x.label)}<small>${esc(x.message)}</small></span><b>${x.ok?'✓':'✕'}</b></div>`).join('')||'<p class="muted">No departments configured.</p>'}</div>`}catch(e){toast(e.message,true)}}
loadState().catch(()=>showLogin());
