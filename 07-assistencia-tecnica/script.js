const CONFIG = {"title": "Assistência técnica", "storage": "assistencia_ordens", "fields": [{"name": "cliente", "label": "Nome do cliente", "type": "text", "required": true}, {"name": "equipamento", "label": "Equipamento", "type": "text", "required": true}, {"name": "defeito", "label": "Defeito relatado", "type": "text", "required": true}, {"name": "data", "label": "Data de entrada", "type": "date", "required": true}, {"name": "tecnico", "label": "Técnico responsável", "type": "text", "required": true}, {"name": "custo", "label": "Custo estimado (R$)", "type": "number", "min": "0", "step": "0.01", "required": true}, {"name": "status", "label": "Status", "type": "select", "options": ["Recebido", "Em diagnóstico", "Aguardando peça", "Em reparo", "Concluído", "Entregue"], "required": true}], "search": ["cliente", "equipamento", "defeito", "tecnico", "status"], "special": "repair"};
const $ = (selector) => document.querySelector(selector);
const form = $("#recordForm");
const idInput = $("#recordId");
const tableArea = $("#tableArea");
const notice = $("#notice");
let records = loadRecords();

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.storage) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Não foi possível ler os dados salvos:", error);
    return [];
  }
}
function persist() {
  try {
    localStorage.setItem(CONFIG.storage, JSON.stringify(records));
    return true;
  } catch (error) {
    showNotice("Não foi possível salvar os dados neste navegador.", "err");
    return false;
  }
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}
function currency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
}
function showNotice(message, type="ok") {
  notice.textContent = message;
  notice.className = `notice show ${type}`;
  window.setTimeout(() => notice.classList.remove("show"), 3500);
}
function labelFor(key) {
  return CONFIG.fields.find(field => field.name === key)?.label || key;
}
function readForm() {
  const item = {};
  for (const field of CONFIG.fields) {
    const element = form.elements[field.name];
    item[field.name] = element ? element.value.trim() : "";
  }
  return item;
}
function normalize(item) {
  const data = {...item};
  for (const field of CONFIG.fields) {
    if (field.type === "number" && data[field.name] !== "") data[field.name] = Number(data[field.name]);
  }
  return data;
}
function validateSpecial(item) {
  if (CONFIG.special === "appointment" || CONFIG.special === "salon") {
    const date = item.data, time = item.hora;
    if (item.status !== "Cancelada" && item.status !== "Cancelado") {
      const conflict = records.some(record => record.id !== idInput.value &&
        record.data === date && record.hora === time &&
        (record.status || "").toLowerCase() !== "cancelada" &&
        (record.status || "").toLowerCase() !== "cancelado");
      if (conflict) return "Já existe um agendamento ativo para essa data e horário.";
    }
  }
  if (CONFIG.special === "school") {
    for (const key of ["nota1","nota2"]) {
      if (Number(item[key]) < 0 || Number(item[key]) > 10) return "As notas devem ficar entre 0 e 10.";
    }
  }
  if (CONFIG.special === "parking" && item.saida && item.entrada && new Date(item.saida) < new Date(item.entrada)) {
    return "A saída não pode ser anterior à entrada.";
  }
  return "";
}
form.addEventListener("submit", event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const item = normalize(readForm());
  const error = validateSpecial(item);
  if (error) { showNotice(error, "err"); return; }
  const editingId = idInput.value;
  if (editingId) {
    records = records.map(record => record.id === editingId ? {...record, ...item} : record);
    showNotice("Cadastro atualizado com sucesso.");
  } else {
    records.unshift({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), criadoEm: new Date().toISOString(), ...item});
    showNotice("Cadastro realizado com sucesso.");
  }
  if (persist()) {
    resetForm();
    render();
  }
});
$("#cancelBtn").addEventListener("click", resetForm);
$("#searchInput").addEventListener("input", render);
$("#exportBtn").addEventListener("click", exportCSV);

function resetForm() {
  form.reset();
  idInput.value = "";
  $("#formTitle").textContent = "Novo cadastro";
  $("#saveBtn").textContent = "Salvar cadastro";
  $("#cancelBtn").hidden = true;
}
function editRecord(id) {
  const item = records.find(record => record.id === id);
  if (!item) return;
  idInput.value = item.id;
  for (const field of CONFIG.fields) {
    const element = form.elements[field.name];
    if (element) element.value = item[field.name] ?? "";
  }
  $("#formTitle").textContent = "Editar cadastro";
  $("#saveBtn").textContent = "Salvar alterações";
  $("#cancelBtn").hidden = false;
  window.scrollTo({top:0, behavior:"smooth"});
}
function deleteRecord(id) {
  const item = records.find(record => record.id === id);
  if (!item) return;
  if (!confirm("Deseja realmente excluir este registro?")) return;
  records = records.filter(record => record.id !== id);
  persist(); render();
  if (idInput.value === id) resetForm();
}
function displayValue(item, field) {
  const value = item[field.name];
  if (value === undefined || value === null || value === "") return "—";
  if (["preco","valor","valorHora","custo"].includes(field.name)) return currency(value);
  if (field.name === "entrada" || field.name === "saida") {
    return value.replace("T", " ");
  }
  if (field.name === "validade" || field.name === "data") {
    const parts = String(value).split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(value);
}
function extraValue(item) {
  switch (CONFIG.special) {
    case "stock": return item.quantidade <= 5 ? "Estoque baixo" : "Disponível";
    case "orders": return currency(Number(item.quantidade || 0) * Number(item.preco || 0));
    case "finance": return item.tipo === "Despesa" ? `− ${currency(item.valor)}` : `+ ${currency(item.valor)}`;
    case "school": return ((Number(item.nota1) + Number(item.nota2))/2).toLocaleString("pt-BR",{maximumFractionDigits:1});
    case "inventory": return Number(item.quantidade) <= Number(item.minimo) ? "Repor estoque" : "Estoque adequado";
    case "parking":
      if (!item.saida) return "Em aberto";
      const hours = Math.max(0, (new Date(item.saida)-new Date(item.entrada))/3600000);
      return currency(Math.ceil(hours) * Number(item.valorHora || 0));
    default: return "";
  }
}
function badgeClass(value) {
  const v = String(value).toLowerCase();
  if (["concluída","concluido","concluída","entregue","presente","disponível","estoque adequado","pronto","confirmada"].some(x=>v.includes(x))) return "good";
  if (["cancel","ausente","baixo","repor","aberto","aguardando"].some(x=>v.includes(x))) return "warn";
  if (["em reparo","preparando","diagnóstico"].some(x=>v.includes(x))) return "warn";
  return "";
}
function getStats() {
  const total = records.length;
  let second = "Ativos", secondValue = total, third = "Resumo", thirdValue = "—";
  switch (CONFIG.special) {
    case "stock":
      secondValue = records.reduce((sum,r)=>sum+Number(r.quantidade||0),0);
      second = "Unidades em estoque";
      third = "Estoque baixo";
      thirdValue = records.filter(r=>Number(r.quantidade)<=5).length;
      break;
    case "appointment":
    case "salon":
      second = "Agendamentos ativos";
      secondValue = records.filter(r=>!String(r.status).toLowerCase().includes("cancel")).length;
      third = "Concluídos";
      thirdValue = records.filter(r=>String(r.status).toLowerCase().includes("conclu")).length;
      break;
    case "orders":
      second = "Pedidos em andamento";
      secondValue = records.filter(r=>!["entregue","cancelado"].includes(String(r.status).toLowerCase())).length;
      third = "Valor dos pedidos";
      thirdValue = currency(records.filter(r=>r.status!=="Cancelado").reduce((s,r)=>s+Number(r.quantidade||0)*Number(r.preco||0),0));
      break;
    case "finance":
      const income=records.filter(r=>r.tipo==="Receita").reduce((s,r)=>s+Number(r.valor||0),0);
      const expense=records.filter(r=>r.tipo==="Despesa").reduce((s,r)=>s+Number(r.valor||0),0);
      second="Receitas"; secondValue=currency(income); third="Saldo"; thirdValue=currency(income-expense);
      break;
    case "school":
      second="Média geral";
      secondValue=records.length ? (records.reduce((s,r)=>s+(Number(r.nota1)+Number(r.nota2))/2,0)/records.length).toLocaleString("pt-BR",{maximumFractionDigits:1}) : "—";
      third="Abaixo de 6";
      thirdValue=records.filter(r=>(Number(r.nota1)+Number(r.nota2))/2<6).length;
      break;
    case "repair":
      second="Em andamento"; secondValue=records.filter(r=>!["concluído","entregue"].includes(String(r.status).toLowerCase())).length;
      third="Concluídos"; thirdValue=records.filter(r=>["concluído","entregue"].includes(String(r.status).toLowerCase())).length;
      break;
    case "inventory":
      second="Unidades registradas"; secondValue=records.reduce((s,r)=>s+Number(r.quantidade||0),0);
      third="Precisam de reposição"; thirdValue=records.filter(r=>Number(r.quantidade)<=Number(r.minimo)).length;
      break;
    case "events":
      second="Participantes presentes"; secondValue=records.filter(r=>r.presenca==="Presente").length;
      third="Eventos diferentes"; thirdValue=new Set(records.map(r=>r.evento)).size;
      break;
    case "parking":
      second="Veículos no local"; secondValue=records.filter(r=>!r.saida).length;
      third="Registros encerrados"; thirdValue=records.filter(r=>!!r.saida).length;
      break;
  }
  const stats=[["Registros cadastrados",total], [second,secondValue], [third,thirdValue]];
  $("#stats").innerHTML=stats.map(([label,value])=>`<article class="stat"><div class="stat-label">${escapeHTML(label)}</div><div class="stat-value">${escapeHTML(value)}</div></article>`).join("");
}
function render() {
  getStats();
  const query = $("#searchInput").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = records.filter(item => CONFIG.search.some(key=>String(item[key] ?? "").toLocaleLowerCase("pt-BR").includes(query)));
  $("#countLabel").textContent = `${filtered.length} de ${records.length} registro(s)`;
  if (!filtered.length) {
    tableArea.innerHTML = `<div class="empty"><strong>${records.length ? "Nenhum resultado encontrado" : "Ainda não há registros"}</strong>${records.length ? "Tente pesquisar por outro termo." : "Use o formulário ao lado para adicionar o primeiro registro."}</div>`;
    return;
  }
  const columns = CONFIG.fields;
  let extraHeader = "";
  if (["orders","school","inventory","parking","stock"].includes(CONFIG.special)) extraHeader = "<th>Resumo</th>";
  const rows = filtered.map(item => {
    const cells = columns.map(field => {
      let value = displayValue(item, field);
      if (field.name === "status" || field.name === "presenca") {
        return `<td><span class="status ${badgeClass(value)}">${escapeHTML(value)}</span></td>`;
      }
      return `<td>${escapeHTML(value)}</td>`;
    }).join("");
    const extra = extraHeader ? `<td>${escapeHTML(extraValue(item))}</td>` : "";
    return `<tr>${cells}${extra}<td><div class="row-actions"><button class="mini-btn" data-edit="${escapeHTML(item.id)}" type="button">Editar</button><button class="mini-btn" data-delete="${escapeHTML(item.id)}" type="button">Excluir</button></div></td></tr>`;
  }).join("");
  tableArea.innerHTML = `<div class="table-wrap"><table><thead><tr>${columns.map(f=>`<th>${escapeHTML(f.label)}</th>`).join("")}${extraHeader}<th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  tableArea.querySelectorAll("[data-edit]").forEach(button=>button.addEventListener("click",()=>editRecord(button.dataset.edit)));
  tableArea.querySelectorAll("[data-delete]").forEach(button=>button.addEventListener("click",()=>deleteRecord(button.dataset.delete)));
}
function exportCSV() {
  if (!records.length) { showNotice("Cadastre pelo menos um registro antes de exportar.", "err"); return; }
  const headers = CONFIG.fields.map(field=>field.label);
  const rows = records.map(item=>CONFIG.fields.map(field=>item[field.name] ?? ""));
  const csv = [headers,...rows].map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href=url; link.download=CONFIG.storage+".csv"; link.click();
  URL.revokeObjectURL(url);
}
render();
