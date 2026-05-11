let appData = {
    organizacion: JSON.parse(localStorage.getItem('erp_org')) || { name: 'Corporativo Industrial S.A.' },
    personal: JSON.parse(localStorage.getItem('erp_pers')) || [],
    unidades: JSON.parse(localStorage.getItem('erp_unidades')) || [{id:1, name:'Planta Monterrey'}],
    areas: JSON.parse(localStorage.getItem('erp_areas')) || [{id:1, unitId:1, name:'Producción'}],
    departamentos: JSON.parse(localStorage.getItem('erp_deptos')) || [{id:1, areaId:1, name:'Mantenimiento'}],
    perfiles: JSON.parse(localStorage.getItem('erp_perf')) || [],
    catalogo: JSON.parse(localStorage.getItem('erp_cat')) || [],
    matrices: JSON.parse(localStorage.getItem('erp_mat')) || [],
    instructors: JSON.parse(localStorage.getItem('erp_instructors')) || [],
    users: JSON.parse(localStorage.getItem('erp_users')) || [
        { id: '1', nombre: 'Administrador', user: 'admin', pass: 'admin123', role: 'ADMIN', unidad: 'ALL', area: 'ALL', depto: 'ALL' }
    ]
};

// CONFIG SUPABASE
const SUPABASE_URL = 'https://amuhlvjubodoaoqdqvyj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtdWhsdmp1Ym9kb2FvcWRxdnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjg1MTIsImV4cCI6MjA5Mzg0NDUxMn0.YYEchJkcpnz-ZxJrAonqCxecNhL4UhHdHH-IdHhE-Zk';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = JSON.parse(sessionStorage.getItem('erp_current_user')) || null;
let saveTimeout;
async function save() {
    // Guardado Local Inmediato para evitar pérdida de datos
    localStorage.setItem('erp_org', JSON.stringify(appData.organizacion));
    localStorage.setItem('erp_pers', JSON.stringify(appData.personal));
    localStorage.setItem('erp_perf', JSON.stringify(appData.perfiles));
    localStorage.setItem('erp_cat', JSON.stringify(appData.catalogo));
    localStorage.setItem('erp_mat', JSON.stringify(appData.matrices));
    localStorage.setItem('erp_unidades', JSON.stringify(appData.unidades));
    localStorage.setItem('erp_areas', JSON.stringify(appData.areas));
    localStorage.setItem('erp_deptos', JSON.stringify(appData.departamentos));
    localStorage.setItem('erp_instructors', JSON.stringify(appData.instructors));
    localStorage.setItem('erp_users', JSON.stringify(appData.users));

    // Debounce para Sincronización Nube y Rerenderizado pesado
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await _supabase.from('app_config').upsert({ id: 1, org_name: appData.organizacion.name }, { onConflict: 'id' });
            await _supabase.from('personal').upsert(appData.personal.map(p => ({
                ficha: p.ficha, nombre: p.nombre, ap_paterno: p.apPaterno, ap_materno: p.apMaterno,
                alta: p.alta, unidad: p.unidad, area: p.area, depto: p.depto, perfil_asignado: p.perfilAsignado
            })), { onConflict: 'ficha' });
            await _supabase.from('matrices').upsert(appData.matrices, { onConflict: 'id' });
        } catch(e) { console.warn("Background Sync Delay:", e); }
        
        // Solo renderizar si no estamos en una vista de edición activa
        if(!document.activeElement || document.activeElement.tagName !== 'INPUT') {
            render();
        }
    }, 500);
}

async function syncFromCloud() {
    try {
        console.log("Sincronizando con Supabase...");
        
        // Cargar Configuración (Nombre de Empresa)
        const { data: config } = await _supabase.from('app_config').select('org_name').eq('id', 1).single();
        if(config) {
            appData.organizacion.name = config.org_name;
            // Actualizar logo en sidebar si existe
            const logoText = document.querySelector('.logo-text');
            if(logoText) logoText.innerText = config.org_name;
        }

        const { data: pers } = await _supabase.from('personal').select('*');
        if(pers && pers.length > 0) {
            appData.personal = pers.map(p => ({
                ficha: p.ficha,
                nombre: p.nombre,
                apPaterno: p.ap_paterno,
                apMaterno: p.ap_materno,
                alta: p.alta,
                unidad: p.unidad,
                area: p.area,
                depto: p.depto,
                perfilAsignado: p.perfil_asignado
            }));
        }

        const { data: users } = await _supabase.from('app_users').select('*');
        if(users && users.length > 0) {
            appData.users = users.map(u => ({
                nombre: u.nombre,
                user: u.username,
                pass: u.password,
                role: u.role,
                unidad: u.unidad,
                area: u.area,
                depto: u.depto
            }));
        }

        const { data: mats } = await _supabase.from('matrices').select('*');
        if(mats) appData.matrices = mats;

        const { data: cats } = await _supabase.from('catalogo').select('*');
        if(cats) appData.catalogo = cats;

        render();
        console.log("Nube sincronizada con éxito.");
    } catch(e) {
        console.warn("Cloud Sync Offline:", e);
    }
}

function render() {
    if(!currentUser) {
        document.getElementById('login-screen').classList.remove('hidden');
        return;
    }
    
    // Actualizar UI del usuario logueado
    document.getElementById('user-name-display').innerText = currentUser.nombre;
    document.getElementById('user-role-display').innerText = currentUser.role === 'ADMIN' ? 'Súper Usuario' : 'Supervisor de Área';
    document.getElementById('user-avatar').innerText = currentUser.nombre.charAt(0);
    document.getElementById('admin-menu').classList.toggle('hidden', currentUser.role !== 'ADMIN');
    
    renderPersonal();
    renderEstructura();
    renderPerfiles();
    renderCatalogo();
    renderMatricesHierarchy();
    renderInstructors();
    renderUsers();
    lucide.createIcons();
}

function renderPersonal() {
    const pb = document.getElementById('list-personal');
    if(!pb) return;

    // --- LOGICA DE FILTROS ---
    const search = document.getElementById('filter-pers-search')?.value.toLowerCase() || "";
    const unitF = document.getElementById('filter-pers-unidad')?.value || "ALL";
    const areaF = document.getElementById('filter-pers-area')?.value || "ALL";
    const deptoF = document.getElementById('filter-pers-depto')?.value || "ALL";

    // Actualizar selects de filtros dinámicamente si están vacíos
    updateFilterOptions();

    const filtered = appData.personal.filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(search) || (p.ficha && p.ficha.toString().includes(search));
        
        // Filtro por permisos de usuario
        const canSeeUnit = currentUser.role === 'ADMIN' || currentUser.unidad === 'ALL' || p.unidad === currentUser.unidad;
        const canSeeArea = currentUser.role === 'ADMIN' || currentUser.area === 'ALL' || p.area === currentUser.area;
        const canSeeDepto = currentUser.role === 'ADMIN' || currentUser.depto === 'ALL' || p.depto === currentUser.depto;

        const matchesUnit = unitF === "ALL" ? canSeeUnit : (p.unidad === unitF && canSeeUnit);
        const matchesArea = areaF === "ALL" ? canSeeArea : (p.area === areaF && canSeeArea);
        const matchesDepto = deptoF === "ALL" ? canSeeDepto : (p.depto === deptoF && canSeeDepto);
        
        return matchesSearch && matchesUnit && matchesArea && matchesDepto;
    });

    pb.innerHTML = filtered.map((p,i)=> {
        // --- FORMATEO DE FECHA EXCEL A DD/MM/AAAA ---
        let fechaAlta = p.alta || '';
        if(!isNaN(fechaAlta) && fechaAlta !== '' && !fechaAlta.toString().includes('-') && !fechaAlta.toString().includes('/')) {
            const dateObj = new Date(Math.round((Number(fechaAlta) - 25569) * 86400 * 1000));
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            fechaAlta = `${dd}/${mm}/${yyyy}`;
        } else if (fechaAlta.includes('-')) {
            const [y, m, d] = fechaAlta.split('-');
            fechaAlta = `${d}/${m}/${y}`;
        }

        return `
            <tr class="hover:bg-slate-50 transition-colors text-[10px]">
                <td class="p-4 text-center"><div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400"><i data-lucide="user" size="14"></i></div></td>
                <td class="p-4 font-bold text-slate-900">${p.ficha || ''}</td>
                <td class="p-4 font-bold uppercase">${p.nombre}</td>
                <td class="p-4 font-bold text-slate-500 uppercase">${p.apPaterno || ''}</td>
                <td class="p-4 font-bold text-slate-500 uppercase">${p.apMaterno || ''}</td>
                <td class="p-4 font-black text-indigo-600">${fechaAlta}</td>
                <td class="p-4 text-[9px] uppercase font-bold text-slate-400">${p.unidad || ''}</td>
                <td class="p-4 text-[9px] uppercase font-bold text-slate-400">${p.area || ''}</td>
                <td class="p-4 font-bold text-blue-600 uppercase">${p.depto || '<span class="text-slate-300 italic text-[8px]">Sin Depto</span>'}</td>
                <td class="p-4">
                    <div class="flex flex-col gap-1">
                        <span class="font-black text-indigo-600 uppercase">${p.perfilAsignado || '<span class="text-slate-300 font-normal">Sin Perfil</span>'}</span>
                        ${p.depto ? `<button onclick="openAssignProfileModalByFicha('${p.ficha}')" class="text-[8px] font-black text-blue-500 hover:underline text-left uppercase">Asignar Perfil</button>` : ''}
                    </div>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="openWorkerDetail('${p.ficha}')" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Expediente e Historial"><i data-lucide="file-text" size="14"></i></button>
                        <button onclick="openLearningMap('${p.ficha}')" class="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg" title="Mapa de Competitividad"><i data-lucide="line-chart" size="14"></i></button>
                        ${currentUser.role === 'ADMIN' ? `<button onclick="openUserModalFromWorker('${p.ficha}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Crear Cuenta de Usuario"><i data-lucide="key" size="14"></i></button>` : ''}
                        ${currentUser.role === 'ADMIN' ? `<button onclick="openEditPersonalModal('${p.ficha}')" class="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg" title="Editar Datos"><i data-lucide="edit-3" size="14"></i></button>` : ''}
                        ${currentUser.role === 'ADMIN' ? `<button onclick="deleteWorkerByUid('${p.uid || p.ficha}')" class="p-1 text-slate-400 hover:text-rose-600" title="Eliminar este registro específico"><i data-lucide="trash-2" size="14"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

function updateFilterOptions() {
    const uS = document.getElementById('filter-pers-unidad');
    const aS = document.getElementById('filter-pers-area');
    const dS = document.getElementById('filter-pers-depto');
    if(!uS) return;

    // Guardar selecciones actuales
    const currentU = uS.value;
    const currentA = aS.value;
    const currentD = dS.value;

    // Obtener datos tanto del personal como de la estructura organizacional maestra
    const unidadesPers = appData.personal.map(p => p.unidad).filter(Boolean);
    const unidadesOrg = appData.unidades.map(u => u.name);
    const unidades = [...new Set([...unidadesPers, ...unidadesOrg])].sort();

    const areasPers = appData.personal.map(p => p.area).filter(Boolean);
    const areasOrg = appData.areas.map(a => a.name);
    const areas = [...new Set([...areasPers, ...areasOrg])].sort();

    const deptosPers = appData.personal.map(p => p.depto).filter(Boolean);
    const deptosOrg = appData.departamentos.map(d => d.name);
    const deptos = [...new Set([...deptosPers, ...deptosOrg])].sort();

    uS.innerHTML = '<option value="ALL">Todas las Unidades</option>' + unidades.map(u => `<option value="${u}">${u}</option>`).join('');
    aS.innerHTML = '<option value="ALL">Todas las Áreas</option>' + areas.map(a => `<option value="${a}">${a}</option>`).join('');
    dS.innerHTML = '<option value="ALL">Todos los Deptos</option>' + deptos.map(d => `<option value="${d}">${d}</option>`).join('');

    // Restaurar selecciones si aún existen
    if(currentU !== 'ALL' && unidades.includes(currentU)) uS.value = currentU;
    if(currentA !== 'ALL' && areas.includes(currentA)) aS.value = currentA;
    if(currentD !== 'ALL' && deptos.includes(currentD)) dS.value = currentD;
}

function openAssignProfileModal(index) {
    const person = appData.personal[index];
    const profilesInDepto = appData.perfiles.filter(pf => pf.depto === person.depto);
    const m = document.getElementById('estructura-modal');
    const title = document.getElementById('est-modal-title');
    const btn = document.getElementById('est-save-btn');
    m.classList.remove('hidden');
    title.innerText = `Asignar Perfil a: ${person.nombre}`;
    document.getElementById('input-name-container').classList.add('hidden');
    document.getElementById('personnel-selector-container').classList.remove('hidden');
    const listContainer = document.getElementById('est-person-list');
    document.getElementById('est-person-search').placeholder = "Buscar perfil...";
    const renderProfiles = (filter = '') => {
        const filtered = profilesInDepto.filter(pf => pf.nombre.toLowerCase().includes(filter.toLowerCase()));
        listContainer.innerHTML = filtered.length ? filtered.map(pf => `
            <div onclick="confirmProfileAssignment(${index}, '${pf.nombre}')" class="p-3 cursor-pointer hover:bg-indigo-50 border-b border-slate-50 transition-all">
                <div class="text-[10px] font-black text-indigo-900 uppercase">${pf.nombre}</div>
                <div class="text-[8px] text-slate-400 uppercase">${pf.unidad} > ${pf.area}</div>
            </div>
        `).join('') : '<p class="p-4 text-[10px] text-slate-400 text-center uppercase font-black">No hay perfiles en este departamento</p>';
    };
    window.confirmProfileAssignment = (idx, profileName) => {
        appData.personal[idx].perfilAsignado = profileName;
        save(); closeEstructuraModal();
    };
    document.getElementById('est-person-search').oninput = (e) => renderProfiles(e.target.value);
    renderProfiles();
}

window.openAssignProfileModalByFicha = (ficha) => {
    const idx = appData.personal.findIndex(p => p.ficha == ficha);
    if(idx !== -1) openAssignProfileModal(idx);
};

window.deleteWorkerByUid = (uid) => {
    if(confirm('¿Estás seguro de eliminar este registro específico? Esta acción no se puede deshacer.')) {
        const idx = appData.personal.findIndex(p => (p.uid || p.ficha) == uid);
        if(idx !== -1) {
            appData.personal.splice(idx, 1);
            save();
        }
    }
};

function renderEstructura() {
    const tree = document.getElementById('org-tree');
    if(!tree) return;
    tree.innerHTML = `
        <div class="bg-slate-900 rounded-[40px] p-10 shadow-2xl relative overflow-hidden border border-slate-800">
            <div class="absolute top-0 right-0 p-8 opacity-10">
                <i data-lucide="network" size="120" class="text-white"></i>
            </div>
            
            <div class="relative z-10 space-y-12">
                <!-- NIVEL 1: ORGANIZACIÓN -->
                <div class="flex items-center gap-4 group">
                    <div class="space-y-1">
                        <span class="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em]">Nivel 1: Organización</span>
                        <div class="flex items-center gap-3">
                            <h2 id="display-org-name" class="text-4xl font-black text-white tracking-tighter uppercase">${appData.organizacion.name}</h2>
                            ${currentUser.role === 'ADMIN' ? `<button onclick="editOrganizacion()" class="p-2 text-slate-500 hover:text-white transition-colors"><i data-lucide="edit-3" size="18"></i></button>` : ''}
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-8">
                    ${appData.unidades.map(u => renderUnidadCard(u)).join('')}
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

function editOrganizacion() {
    const nuevoNombre = prompt("Ingresa el nuevo nombre de la organización:", appData.organizacion.name);
    if(nuevoNombre && nuevoNombre.trim() !== "") {
        appData.organizacion.name = nuevoNombre.trim();
        save(); // Esto guardará en local y en la tabla app_config de Supabase
    }
}

function renderUnidadCard(u) {
    const areas = appData.areas.filter(a => a.unitId === u.id);
    return `
        <div class="bg-white/5 border border-white/10 rounded-[30px] p-8 shadow-xl">
            <div class="flex justify-between items-center mb-8">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center font-black text-xl border border-blue-400/20">${u.name.charAt(0)}</div>
                    <div>
                        <h3 class="text-xl font-black text-white uppercase tracking-tight">${u.name}</h3>
                        <div class="flex gap-2 mt-1">
                            <button onclick="editNode('unidad', ${u.id})" class="p-1 text-slate-500 hover:text-blue-400 transition-colors"><i data-lucide="edit-2" size="14"></i></button>
                            <button onclick="deleteNode('unidad', ${u.id})" class="p-1 text-slate-500 hover:text-rose-500 transition-colors"><i data-lucide="trash-2" size="14"></i></button>
                        </div>
                    </div>
                </div>
                <button onclick="openEstructuraModal('area', ${u.id})" class="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20">
                    <i data-lucide="plus" size="16"></i>
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${areas.map(a => renderArea(a)).join('')}
            </div>
        </div>
    `;
}

function editNode(type, id) {
    const list = type === 'unidad' ? appData.unidades : (type === 'area' ? appData.areas : appData.departamentos);
    const node = list.find(n => n.id === id);
    if(!node) return;
    const newName = prompt(`Editar nombre de ${type}:`, node.name);
    if(newName) { node.name = newName; save(); }
}

function deleteNode(type, id) {
    if(!confirm(`¿Estás seguro de eliminar esta ${type}? Se perderá toda su estructura interna.`)) return;
    if(type === 'unidad') appData.unidades = appData.unidades.filter(u => u.id !== id);
    if(type === 'area') appData.areas = appData.areas.filter(a => a.id !== id);
    if(type === 'depto') appData.departamentos = appData.departamentos.filter(d => d.id !== id);
    save();
}

function renderArea(a) {
    const deptos = appData.departamentos.filter(d => d.areaId === a.id);
    const isCollapsed = a.collapsed || false;
    return `
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col transition-all">
            <div class="flex justify-between items-center mb-4">
                <div class="flex flex-col">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nivel 3: Área</span>
                    <div class="flex items-center gap-2">
                        <h4 class="font-black text-slate-900 text-xs">${a.name}</h4>
                        ${currentUser.role === 'ADMIN' ? `
                            <div class="flex gap-1">
                                <button onclick="editNode('area', ${a.id})" class="p-1 text-slate-300 hover:text-blue-600 transition-colors"><i data-lucide="edit-2" size="10"></i></button>
                                <button onclick="deleteNode('area', ${a.id})" class="p-1 text-slate-300 hover:text-rose-600 transition-colors"><i data-lucide="trash-2" size="10"></i></button>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="flex gap-1">
                    <button onclick="toggleArea(${a.id})" class="p-1 text-slate-300 hover:text-blue-600"><i data-lucide="${isCollapsed ? 'maximize-2' : 'minimize-2'}" size="12"></i></button>
                    <button onclick="openEstructuraModal('depto', ${a.id})" class="p-1 text-blue-600 rounded hover:bg-blue-50"><i data-lucide="plus-circle" size="12"></i></button>
                </div>
            </div>
            <div class="space-y-3 ${isCollapsed ? 'hidden' : ''}">${deptos.map(d => renderDepto(d)).join('')}</div>
        </div>
    `;
}

function renderDepto(d) {
    const countPers = appData.personal.filter(p => p.depto === d.name).length;
    return `
        <div class="bg-slate-50 rounded-xl p-4 border border-slate-100 group">
            <div class="flex justify-between items-center mb-3">
                <h5 class="text-[11px] font-bold text-slate-900">${d.name}</h5>
                ${currentUser.role === 'ADMIN' ? `
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="editNode('depto', ${d.id})" class="p-1 text-slate-400 hover:text-blue-600"><i data-lucide="edit-2" size="10"></i></button>
                        <button onclick="deleteNode('depto', ${d.id})" class="p-1 text-slate-400 hover:text-rose-600"><i data-lucide="trash-2" size="10"></i></button>
                    </div>
                ` : ''}
            </div>
            <div class="flex gap-2">
                <div onclick="showNodeDetails('personal_list', '${d.name}')" class="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-[8px] font-black cursor-pointer hover:bg-blue-200 transition-all">
                    <i data-lucide="users" size="10"></i> ${countPers} PERS
                </div>
                <button onclick="openEstructuraModal('asignar_personal', null, '${d.name}')" class="px-2 py-1 text-[7px] font-black text-blue-600 border border-blue-200 rounded-md hover:bg-blue-600 hover:text-white transition-all">+ ASIGNAR</button>
            </div>
        </div>
    `;
}

function toggleArea(id) { const area = appData.areas.find(a => a.id === id); if(area) { area.collapsed = !area.collapsed; save(); } }
function toggleAllAreas(collapsed) { appData.areas.forEach(a => a.collapsed = collapsed); save(); }

function showNodeDetails(type, name) {
    const m = document.getElementById('estructura-modal');
    const title = document.getElementById('est-modal-title');
    const saveBtn = document.getElementById('est-save-btn');
    const temp = document.getElementById('temp-detail'); if(temp) temp.remove();
    
    m.classList.remove('hidden');
    document.getElementById('input-name-container').classList.add('hidden');
    
    if(type === 'org') {
        title.innerText = `INFORMACIÓN CORPORATIVA`;
        document.getElementById('personnel-selector-container').classList.add('hidden');
        document.getElementById('search-bar-container').classList.add('hidden');
        const infoHtml = `
            <div class="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
                    <i data-lucide="building-2" size="32"></i>
                </div>
                <h4 class="text-xl font-black text-slate-900 uppercase">${name}</h4>
                <p class="text-xs text-slate-400 font-bold mt-1 tracking-widest uppercase">Nivel 1: Sede Principal</p>
                <div class="mt-6 grid grid-cols-2 gap-4">
                    <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                        <div class="text-[10px] font-black text-slate-400 uppercase">Unidades</div>
                        <div class="text-2xl font-black text-blue-600">${appData.unidades.length}</div>
                    </div>
                    <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                        <div class="text-[10px] font-black text-slate-400 uppercase">Total Personal</div>
                        <div class="text-2xl font-black text-indigo-600">${appData.personal.length}</div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('est-modal-body').insertAdjacentHTML('beforeend', `<div id="temp-detail">${infoHtml}</div>`);
    } else {
        document.getElementById('personnel-selector-container').classList.remove('hidden');
        title.innerText = type === 'personal_list' ? `DETALLE DE PERSONAL: ${name}` : `Detalle de ${name}`;
        const listContainer = document.getElementById('est-person-list');
        document.getElementById('search-bar-container').classList.add('hidden');
        
        if(type === 'personal_list') {
            const pers = appData.personal.map((p, idx) => ({p, idx})).filter(item => item.p.depto === name);
            listContainer.innerHTML = pers.length ? pers.map(item => `
                <div class="p-4 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 transition-all">
                    <div>
                        <div class="text-[11px] font-black text-slate-800 uppercase">${item.p.nombre} ${item.p.apPaterno}</div>
                        <div class="text-[9px] text-slate-400 font-bold">FICHA: ${item.p.ficha}</div>
                        <div class="text-[9px] text-indigo-600 font-black mt-1 uppercase">${item.p.perfilAsignado || 'Sin Perfil Asignado'}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="openAssignProfileModal(${item.idx})" class="px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black rounded-lg shadow-md hover:bg-blue-700 transition-all uppercase">
                            Perfil
                        </button>
                        ${currentUser.role === 'ADMIN' ? `
                            <button onclick="unassignFromDepto(${item.idx})" class="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Quitar de este Departamento">
                                <i data-lucide="user-minus" size="14"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('') : '<p class="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No hay personal asignado a este departamento</p>';
        }
    }
    
    window.unassignFromDepto = (idx) => {
        if(confirm(`¿Quitar a ${appData.personal[idx].nombre} de este departamento?`)) {
            appData.personal[idx].depto = "";
            appData.personal[idx].perfilAsignado = "";
            save();
            closeEstructuraModal();
        }
    };
    
    saveBtn.innerText = "CERRAR";
    saveBtn.classList.remove('hidden');
    saveBtn.onclick = closeEstructuraModal;
    lucide.createIcons();
}

function openEstructuraModal(type, parentId = null, deptoName = null) {
    const m = document.getElementById('estructura-modal');
    const title = document.getElementById('est-modal-title');
    const btn = document.getElementById('est-save-btn');
    const nameContainer = document.getElementById('input-name-container');
    const selectorContainer = document.getElementById('personnel-selector-container');
    const nameInput = document.getElementById('est-name');
    const temp = document.getElementById('temp-detail'); if(temp) temp.remove();
    m.classList.remove('hidden'); nameContainer.classList.remove('hidden'); selectorContainer.classList.add('hidden');
    nameInput.readOnly = false; btn.disabled = false; btn.innerText = "CONFIRMAR";

    if(type === 'asignar_personal') {
        title.innerText = `ASIGNAR PERSONAL A: ${deptoName}`;
        nameContainer.classList.add('hidden');
        selectorContainer.classList.remove('hidden');
        document.getElementById('search-bar-container').classList.remove('hidden');
        const list = document.getElementById('est-person-list');
        btn.classList.add('hidden'); 

        const renderBatchList = (search = "") => {
            const available = appData.personal.filter(p => (!p.depto || p.depto === "") && (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.ficha.toString().includes(search)));
            list.innerHTML = `
                <div class="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center sticky top-0 z-10">
                    <span id="count-selected" class="text-[9px] font-black text-blue-600 uppercase">0 SELECCIONADOS</span>
                    <button onclick="assignSelectedToDepto('${deptoName}')" id="bulk-assign-btn" class="hidden bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">Asignar ahora</button>
                </div>
                ${available.length ? available.map(p => `
                    <label class="flex items-center gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-all">
                        <input type="checkbox" value="${p.ficha}" onchange="updateSelectedCount()" class="batch-check w-4 h-4 rounded border-slate-300 text-blue-600">
                        <div>
                            <div class="text-[10px] font-black text-slate-800 uppercase">${p.nombre} ${p.apPaterno}</div>
                            <div class="text-[8px] text-slate-400 font-bold uppercase">FICHA: ${p.ficha} | ${p.unidad || 'SIN UNIDAD'}</div>
                        </div>
                    </label>
                `).join('') : '<div class="p-8 text-center text-[10px] font-bold text-slate-400 uppercase">No hay personal disponible para asignar</div>'}
            `;
        };

        window.updateSelectedCount = () => {
            const checks = document.querySelectorAll('.batch-check:checked');
            document.getElementById('count-selected').innerText = `${checks.length} SELECCIONADOS`;
            document.getElementById('bulk-assign-btn').classList.toggle('hidden', checks.length === 0);
        };

        window.assignSelectedToDepto = (dName) => {
            const checks = document.querySelectorAll('.batch-check:checked');
            checks.forEach(c => {
                const person = appData.personal.find(p => p.ficha == c.value);
                if(person) {
                    person.depto = dName;
                    const deptoObj = appData.departamentos.find(dep => dep.name === dName);
                    if(deptoObj) {
                        const areaObj = appData.areas.find(a => a.id === deptoObj.areaId);
                        const unitObj = areaObj ? appData.unidades.find(u => u.id === areaObj.unitId) : null;
                        if(areaObj) person.area = areaObj.name;
                        if(unitObj) person.unidad = unitObj.name;
                    }
                }
            });
            save();
            closeEstructuraModal();
        };

        document.getElementById('est-person-search').oninput = (e) => renderBatchList(e.target.value);
        renderBatchList();
    } else {
        btn.onclick = () => { 
            const name = nameInput.value; 
            if(name) { 
                if(type === 'unidad') appData.unidades.push({id: Date.now(), name: name}); 
                if(type === 'area') appData.areas.push({id: Date.now(), unitId: parentId, name: name}); 
                if(type === 'depto') appData.departamentos.push({id: Date.now(), areaId: parentId, name: name}); 
                save(); 
                closeEstructuraModal(); 
            } 
        };
    }
}

function closeEstructuraModal() { document.getElementById('estructura-modal').classList.add('hidden'); }

function renderPerfiles() {
    const pf = document.getElementById('list-perfiles'); if(!pf) return;
    pf.innerHTML = appData.perfiles.map((p,i)=>{
        const assignedCount = appData.personal.filter(pers => pers.perfilAsignado === p.nombre).length;
        return `
            <tr class="text-xs hover:bg-slate-50 transition-all">
                <td class="p-4 font-bold text-slate-900">${p.nombre}</td>
                <td class="p-4 text-[9px] font-black text-blue-600 uppercase">${p.unidad} > ${p.area} > ${p.depto}</td>
                <td class="p-4 font-medium text-slate-500">${p.edu || '-'}</td>
                <td class="p-4 text-center">
                    <button onclick="showAssignedPersonnel('${p.nombre}')" class="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full font-black text-[10px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                        ${assignedCount} PERSONAS
                    </button>
                </td>
                <td class="p-4 text-center">
                    <button onclick="if(confirm('¿Eliminar?')) { appData.perfiles.splice(${i},1); save(); }" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><i data-lucide="trash-2" size="14"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function showAssignedPersonnel(profileName) {
    const assigned = appData.personal.filter(p => p.perfilAsignado === profileName);
    const m = document.getElementById('estructura-modal');
    const title = document.getElementById('est-modal-title');
    const btn = document.getElementById('est-save-btn');
    
    m.classList.remove('hidden');
    title.innerText = `Personal en Puesto: ${profileName}`;
    document.getElementById('input-name-container').classList.add('hidden');
    document.getElementById('personnel-selector-container').classList.remove('hidden');
    document.getElementById('search-bar-container').classList.remove('hidden');
    
    const listContainer = document.getElementById('est-person-list');
    document.getElementById('est-person-search').classList.add('hidden');
    
    listContainer.innerHTML = assigned.length ? assigned.map(p => `
        <div class="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 rounded-lg mb-1">
            <div>
                <div class="text-[10px] font-black text-slate-800 uppercase">${p.nombre} ${p.apPaterno}</div>
                <div class="text-[8px] text-slate-400 font-bold tracking-widest">FICHA: ${p.ficha}</div>
            </div>
            <div class="text-[8px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded uppercase">${p.depto}</div>
        </div>
    `).join('') : '<p class="p-4 text-[10px] text-slate-400 text-center uppercase font-black">No hay personal asignado</p>';
    
    btn.classList.remove('hidden');
    btn.innerText = "CERRAR";
    btn.onclick = closeEstructuraModal;
}

function updateAreaSelect() {
    const unitId = document.getElementById('p-unidad').value;
    const areas = appData.areas.filter(a => a.unitId == unitId);
    const select = document.getElementById('p-area');
    select.innerHTML = areas.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    updateDeptoSelect();
}

function updateDeptoSelect() {
    const areaId = document.getElementById('p-area').value;
    const deptos = appData.departamentos.filter(d => d.areaId == areaId);
    const select = document.getElementById('p-depto');
    select.innerHTML = deptos.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
}

function savePerfilFull() {
    const getVal = (id) => document.getElementById(id)?.value || '';
    const getHtml = (id) => document.getElementById(id)?.innerHTML || '';
    const perfil = {
        nombre: getVal('p-name'), edu: getVal('p-edu'),
        unidad: document.getElementById('p-unidad').options[document.getElementById('p-unidad').selectedIndex]?.text || '',
        area: document.getElementById('p-area').options[document.getElementById('p-area').selectedIndex]?.text || '',
        depto: getVal('p-depto'), desc: getVal('p-desc'), funciones: getVal('p-funciones'),
        autoridad: getVal('p-autoridad'), decisiones: getVal('p-decisiones'), relaciones: getVal('p-relaciones'),
        exp: getVal('p-exp'), idiomas: getVal('p-idiomas'), tech: getHtml('p-tech'), soft: getHtml('p-soft'),
        riesgos: getVal('p-riesgos'), condiciones: getVal('p-condiciones'), recursos: getVal('p-recursos'),
        fisico: getVal('p-fisico'), fecha: getVal('p-fecha'), aprobado: getVal('p-aprobado')
    };
    if(!perfil.nombre) return alert('Nombre de puesto obligatorio');
    appData.perfiles.push(perfil);
    save(); closePerfilModal();
}

function addTag(containerId, text = null) {
    const container = document.getElementById(containerId);
    const val = text || prompt('Ingresa el conocimiento o habilidad:');
    if(!val) return;
    const span = document.createElement('span');
    span.className = `px-3 py-1 rounded-full text-[9px] font-black border cursor-pointer hover:bg-rose-50 hover:border-rose-300 transition-all ${containerId==='p-tech' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`;
    span.innerHTML = `${val} <i data-lucide="x" class="inline ml-1" size="8"></i>`;
    span.onclick = () => span.remove();
    container.appendChild(span);
    lucide.createIcons();
}

function generateWithIA() {
    const n = document.getElementById('p-name').value || "Líder de Operaciones";
    alert('El Asesor IA está estructurando el perfil corporativo...');
    
    document.getElementById('p-edu').value = n.toLowerCase().includes('gerente') || n.toLowerCase().includes('lider') ? "Maestría en Administración, MBA o Ingeniería Especializada con Título Profesional." : "Licenciatura o Ingeniería (Titulado). Certificaciones técnicas afines.";
    document.getElementById('p-desc').value = `Garantizar la excelencia operativa y la rentabilidad del área mediante la gestión estratégica de recursos, cumplimiento de normativas internacionales y el desarrollo de una cultura de alto desempeño y seguridad.`;
    document.getElementById('p-funciones').value = `1. Definir y supervisar los KPIs críticos del área.\n2. Liderar proyectos de mejora continua y optimización de costos.\n3. Asegurar el cumplimiento de normativas de seguridad y medio ambiente.\n4. Gestionar el desarrollo de talento y planes de carrera.\n5. Administrar el presupuesto operativo asignado.`;
    document.getElementById('p-autoridad').value = `Aprobación de gastos operativos, sanción o reconocimiento de personal directo, detención de procesos inseguros y selección de proveedores técnicos.`;
    document.getElementById('p-decisiones').value = `Ajustes en la planificación semanal, asignación de turnos críticos, priorización de inversiones en mantenimiento y validación de estándares de calidad.`;
    document.getElementById('p-relaciones').value = `Internas: Gerencias de Planta, RRHH, Finanzas.\nExternas: Clientes estratégicos, Auditores de Certificación e Instituciones Gubernamentales.`;
    document.getElementById('p-exp').value = "5 a 8 años en posiciones de liderazgo en el sector industrial de alta manufactura.";
    document.getElementById('p-idiomas').value = "Inglés Técnico/Negocios (Nivel Avanzado - Capacidad de negociación).";
    
    document.getElementById('p-tech').innerHTML = ''; document.getElementById('p-soft').innerHTML = '';
    ['Estrategia Operativa', 'Gestión de Proyectos', 'Análisis de Riesgos', 'Lean Manufacturing'].forEach(t => addTag('p-tech', t));
    ['Pensamiento Estratégico', 'Comunicación Influyente', 'Toma de Decisiones', 'Resolución de Conflictos'].forEach(s => addTag('p-soft', s));
    
    document.getElementById('p-riesgos').value = `Estrés laboral por alta responsabilidad, exposición a ambiente de planta (EPP obligatorio) y fatiga visual/cognitiva.`;
    document.getElementById('p-condiciones').value = `Entorno híbrido (Oficina/Planta), disponibilidad para viajar y atención a emergencias operativas fuera de horario si es crítico.`;
    document.getElementById('p-recursos').value = `Presupuesto anual de área, flota de transporte, equipo de cómputo y herramientas de comunicación corporativa.`;
    document.getElementById('p-fisico').value = `Capacidad de concentración prolongada y aptitud para recorridos en áreas industriales.`;
    document.getElementById('p-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('p-aprobado').value = "ASESORIA-ERP-V1 / DIR-GRAL";
    lucide.createIcons();
}

function openPerfilModal() { 
    const m = document.getElementById('perfil-modal');
    m.classList.remove('hidden');
    const fields = ['p-name', 'p-edu', 'p-desc', 'p-funciones', 'p-autoridad', 'p-decisiones', 'p-relaciones', 'p-exp', 'p-idiomas', 'p-riesgos', 'p-condiciones', 'p-recursos', 'p-fisico', 'p-fecha', 'p-aprobado'];
    fields.forEach(f => { const el = document.getElementById(f); if(el) el.value = ''; });
    document.getElementById('p-tech').innerHTML = '';
    document.getElementById('p-soft').innerHTML = '';
    const uSelect = document.getElementById('p-unidad');
    uSelect.innerHTML = appData.unidades.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    updateAreaSelect();
    switchTab('general', document.querySelector('.tab-btn'));
}

function closePerfilModal() { document.getElementById('perfil-modal').classList.add('hidden'); }

function exportDatabase() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.personal), "Personal");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appData.perfiles), "Perfiles");
    XLSX.writeFile(wb, "ERP_Industrial_Data.xlsx");
}

function importFromExcel(ev) {
    const r = new FileReader();
    r.onload = (e) => {
        const b = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
        const raw = XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]]);
        
        appData.personal = raw.map(row => {
            // Normalizar las llaves de la fila (quitar espacios, acentos y pasar a minúsculas)
            const clean = {};
            Object.keys(row).forEach(k => {
                const normalizedKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                clean[normalizedKey] = row[k];
            });

            // Función para buscar valor por múltiples posibles nombres de columna
            const get = (aliases) => {
                for(let a of aliases) { if(clean[a] !== undefined) return clean[a]; }
                return '';
            };

            // Formatear fecha de Excel (si viene como número serial)
            let fechaAlta = get(['alta', 'fechaalta', 'ingreso', 'fecha']);
            if(!isNaN(fechaAlta) && fechaAlta !== '') {
                const dateObj = new Date(Math.round((Number(fechaAlta) - 25569) * 86400 * 1000));
                fechaAlta = dateObj.toISOString().split('T')[0];
            }

            return {
                uid: Date.now().toString() + Math.random(),
                ficha: get(['ficha', 'num', 'id', 'numero', 'fichas']),
                nombre: get(['nombre', 'nombres', 'name']),
                apPaterno: get(['appaterno', 'paterno', 'apellido1', 'apellidopaterno']),
                apMaterno: get(['apmaterno', 'materno', 'apellido2', 'apellidomaterno']),
                alta: fechaAlta,
                unidad: get(['unidad', 'plantel', 'sede', 'unidades']),
                area: get(['area', 'seccion', 'areas']),
                depto: get(['depto', 'departamento', 'areaespecifica', 'departamentos']),
                perfilAsignado: get(['perfil', 'puesto', 'cargo', 'posicion'])
            };
        }).filter(p => p.nombre && p.nombre.trim() !== ""); // FILTRO: Solo filas con nombre
        
        save();
        alert(`¡Éxito! Se han importado ${appData.personal.length} registros válidos.`);
        render(); // Refrescar toda la interfaz
    };
    r.readAsArrayBuffer(ev.target.files[0]);
}

window.cleanEmptyPersonal = () => {
    const totalOriginal = appData.personal.length;
    appData.personal = appData.personal.filter(p => p.nombre && p.nombre.trim() !== "");
    const borrados = totalOriginal - appData.personal.length;
    save();
    render();
    alert(`Se han eliminado ${borrados} filas vacías o incompletas.`);
};

function switchTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

        function toggleSubmenu(id) { document.getElementById(id).classList.toggle('hidden'); lucide.createIcons(); }
        let currentEditCatIdx = null;
        let currentEditFileData = null;
        let currentActiveMatrizId = null;
        let tempSelectedTopics = [];
        const getMonthName = (dateStr) => {
            if(!dateStr) return 'SIN FECHA';
            try {
                const date = new Date(dateStr + 'T00:00:00');
                return date.toLocaleString('es-MX', { month: 'long' }).toUpperCase();
            } catch(e) { return 'SIN FECHA'; }
        };

        let selectedPersonnelIds = [];
        let evidenceTarget = { ficha: null, topicCode: null, bulk: false };
        let currentActiveUnitId = null;
        let currentActiveAreaId = null;

        // --- HELPER DE CALCULO DE KPIs PARA CUALQUIER MATRIZ ---
        function calculateMatrixKPIs(matriz) {
            const personnel = appData.personal.filter(p => p.depto === matriz.depto);
            const selectedTopics = (matriz.topics || []).map(topicObj => {
                const isObj = typeof topicObj === 'object' && topicObj !== null;
                const code = isObj ? topicObj.code : topicObj;
                const catalogItem = appData.catalogo.find(c => c.codigo === code);
                return catalogItem ? { ...catalogItem, ...(isObj ? topicObj : {}) } : null;
            }).filter(Boolean);

            let totalProgCount = 0;
            let totalDoneCount = 0;
            let totalExecHours = 0;

            personnel.forEach(p => {
                const att = matriz.attendance ? (matriz.attendance[p.ficha] || {}) : {};
                selectedTopics.forEach(t => {
                    const topicAtt = att[t.codigo] || {};
                    if(topicAtt.status === 'programmed') totalProgCount++;
                    else if(topicAtt.status === 'finished') {
                        totalProgCount++;
                        totalDoneCount++;
                        totalExecHours += parseFloat(topicAtt.hours || 0);
                    }
                });
            });

            return {
                compliance: totalProgCount ? Math.round((totalDoneCount / totalProgCount) * 100) : 0,
                hours: totalExecHours.toFixed(1),
                topicsCount: selectedTopics.length
            };
        }

        // --- FUNCIONES GLOBALES DE REPORTE ---
        window.openMonthlyReport = function() {
            try {
                console.log("Iniciando Render de Reporte Mensual...");
                const matriz = appData.matrices.find(m => m.id === currentActiveMatrizId);
                if(!matriz) {
                    console.error("No se encontró matriz activa");
                    return;
                }
                
                const personnel = appData.personal.filter(p => p.depto === matriz.depto);
                const selectedTopics = (matriz.topics || []).map(topicObj => {
                    const isObj = typeof topicObj === 'object' && topicObj !== null;
                    const code = isObj ? topicObj.code : topicObj;
                    const catalogItem = appData.catalogo.find(c => c.codigo === code);
                    return catalogItem ? { ...catalogItem, ...(isObj ? topicObj : {}) } : null;
                }).filter(Boolean);

                const months = {};
                selectedTopics.forEach(t => {
                    const mName = getMonthName(t.date);
                    if(!months[mName]) months[mName] = [];
                    
                    let progCount = 0;
                    let doneCount = 0;
                    personnel.forEach(p => {
                        const status = matriz.attendance?.[p.ficha]?.[t.codigo]?.status;
                        if(status === 'programmed') progCount++;
                        if(status === 'finished') { progCount++; doneCount++; }
                    });
                    const compliance = progCount ? Math.round((doneCount / progCount) * 100) : 0;
                    months[mName].push({ ...t, compliance, progCount, doneCount });
                });

                const container = document.getElementById('monthly-report-content');
                if(!container) throw new Error("No se encontró el contenedor");

                if(!Object.keys(months).length) {
                    container.innerHTML = '<div class="col-span-full p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">No hay temas programados con fecha</div>';
                    document.getElementById('monthly-report-modal').classList.remove('hidden');
                    return;
                }

                // Generar tabla limpia organizada por mes
                let html = `
                <div class="col-span-full overflow-hidden rounded-2xl border border-slate-100 bg-white">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-100">
                                <th class="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Mes</th>
                                <th class="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                                <th class="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tema de Capacitación</th>
                                <th class="p-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Prog.</th>
                                <th class="p-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Cump.</th>
                                <th class="p-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">% Avance</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                // Ordenamos los meses cronológicamente si es posible
                const monthOrder = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE", "SIN FECHA"];
                const sortedMonths = Object.keys(months).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

                sortedMonths.forEach(mName => {
                    months[mName].forEach((t, idx) => {
                        html += `
                        <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            ${idx === 0 ? `<td rowspan="${months[mName].length}" class="p-4 text-[10px] font-black text-blue-600 bg-slate-50/30 border-r border-slate-100">${mName}</td>` : ''}
                            <td class="p-4 text-[9px] font-bold text-slate-400">${t.codigo}</td>
                            <td class="p-4 text-[10px] font-black text-slate-700 uppercase">${t.nombre}</td>
                            <td class="p-4 text-center text-[10px] font-bold text-slate-600">${t.progCount}</td>
                            <td class="p-4 text-center text-[10px] font-bold text-emerald-600">${t.doneCount}</td>
                            <td class="p-4">
                                <div class="flex items-center gap-3 justify-center">
                                    <div class="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div class="bg-blue-600 h-full" style="width: ${t.compliance}%"></div>
                                    </div>
                                    <span class="text-[9px] font-black text-blue-600">${t.compliance}%</span>
                                </div>
                            </td>
                        </tr>
                        `;
                    });
                });

                html += `</tbody></table></div>`;
                container.innerHTML = html;
                document.getElementById('monthly-report-modal').classList.remove('hidden');
                lucide.createIcons();
            } catch(err) {
                console.error("Error al abrir reporte:", err);
                alert("Hubo un error al generar el reporte mensual.");
            }
        };

        window.closeMonthlyReport = function() { 
            document.getElementById('monthly-report-modal').classList.add('hidden'); 
        };

function renderCatalogo() {
    const types = [
        {id: 'procedimientos', filter: 'Procedimiento'},
        {id: 'normas', filter: 'Normas'},
        {id: 'seguridad', filter: 'Seguridad'},
        {id: 'salud', filter: 'Salud'},
        {id: 'tecnico', filter: 'Tecnico'}
    ];

    const getFileIcon = (type, idx) => {
        const icons = { 'PDF': 'file-text', 'Word': 'file-type-2', 'Excel': 'file-spreadsheet', 'PowerPoint': 'presentation', 'Video': 'video' };
        const colors = { 'PDF': 'text-rose-600', 'Word': 'text-blue-600', 'Excel': 'text-emerald-600', 'PowerPoint': 'text-orange-600', 'Video': 'text-purple-600' };
        return `<div onclick="viewCatalogoFile(${idx})" class="flex items-center justify-center gap-1 cursor-pointer hover:scale-110 transition-transform ${colors[type] || 'text-slate-400'}">
                    <i data-lucide="${icons[type] || 'file'}" size="14"></i>
                    <span class="text-[9px] font-black">${type}</span>
                </div>`;
    };

    types.forEach(t => {
        const container = document.getElementById(`list-cat-${t.id}`);
        if(!container) return;
        const items = appData.catalogo.map((item, idx) => ({item, idx})).filter(x => x.item.categoria === t.filter || (t.id === 'tecnico' && !['Procedimiento', 'Normas', 'Seguridad', 'Salud'].includes(x.item.categoria)));
        
        container.innerHTML = items.length ? items.map(x => `
            <tr class="hover:bg-slate-50 transition-all text-xs">
                <td class="p-4 font-black text-slate-500">${x.item.codigo || 'S/C'}</td>
                <td class="p-4 font-black text-slate-900 uppercase">${x.item.nombre}</td>
                <td class="p-4"><span class="text-[10px] font-bold text-slate-600 uppercase">${x.item.areaAplica || 'GENERAL'}</span></td>
                <td class="p-4"><span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase">${x.item.categoria}</span></td>
                <td class="p-4 font-bold text-indigo-600">${x.item.instructor}</td>
                <td class="p-4 text-center">${getFileIcon(x.item.archivo || 'PDF', x.idx)}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        ${currentUser.role === 'ADMIN' ? `
                            <button onclick="openCatalogoModal(null, ${x.idx})" class="p-1 text-slate-300 hover:text-blue-500 transition-colors"><i data-lucide="edit-3" size="14"></i></button>
                            <button onclick="deleteCatalogoItem(${x.idx})" class="p-1 text-slate-300 hover:text-rose-500 transition-colors"><i data-lucide="trash-2" size="14"></i></button>
                        ` : '<span class="text-[8px] font-black text-slate-300 uppercase tracking-widest">Solo Lectura</span>'}
                    </div>
                </td>
            </tr>
        `).join('') : `<tr><td colspan="7" class="p-8 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No hay registros en esta categoría</td></tr>`;
    });
    lucide.createIcons();
}

function toggleNewAreaField() {
    const select = document.getElementById('cat-area');
    const container = document.getElementById('new-area-container');
    container.classList.toggle('hidden', select.value !== 'NUEVA AREA');
}

        function updateFileLabel(input) {
            const label = document.getElementById('file-label');
            if(input.files && input.files[0]) {
                const file = input.files[0];
                label.innerText = file.name.toUpperCase();
                label.parentElement.classList.add('border-blue-400', 'text-blue-600');
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentEditFileData = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

function openCatalogoModal(defaultCat = 'Procedimiento', idx = null) {
    const m = document.getElementById('catalogo-modal');
    const title = document.getElementById('cat-modal-title');
    m.classList.remove('hidden');
    currentEditCatIdx = idx;
    currentEditFileData = null;

    if(idx !== null) {
        const item = appData.catalogo[idx];
        title.innerText = "Editar Item de Catálogo";
        document.getElementById('cat-code').value = item.codigo || '';
        document.getElementById('cat-name').value = item.nombre || '';
        document.getElementById('cat-desc').value = item.descripcion || '';
        document.getElementById('cat-instructor').value = item.instructor || '';
        document.getElementById('cat-category').value = item.categoria || 'Procedimiento';
        document.getElementById('cat-area').value = item.areaAplica || 'MANTENIMIENTO';
        document.getElementById('file-label').innerText = item.fileName ? item.fileName.toUpperCase() : 'SUBIR ARCHIVO';
        document.getElementById('new-area-container').classList.add('hidden');
    } else {
        title.innerText = "Nuevo Item de Catálogo";
        document.getElementById('cat-code').value = '';
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-desc').value = '';
        document.getElementById('cat-instructor').value = '';
        document.getElementById('cat-category').value = defaultCat || 'Procedimiento';
        document.getElementById('cat-area').value = 'MANTENIMIENTO';
        document.getElementById('new-area-container').classList.add('hidden');
        document.getElementById('cat-new-area').value = '';
        document.getElementById('file-label').innerText = 'SUBIR ARCHIVO';
        document.getElementById('cat-file-upload').value = '';
    }
}

function closeCatalogoModal() { document.getElementById('catalogo-modal').classList.add('hidden'); }

window.openEditPersonalModal = (ficha) => {
    const p = appData.personal.find(pers => pers.ficha == ficha);
    if(!p) return;
    
    document.getElementById('personal-modal').classList.remove('hidden');
    document.querySelector('#personal-modal h3').innerText = "Editar Trabajador";
    document.getElementById('new-p-ficha').value = p.ficha;
    document.getElementById('new-p-ficha').readOnly = true;
    document.getElementById('new-p-nombre').value = p.nombre;
    document.getElementById('new-p-paterno').value = p.apPaterno || '';
    document.getElementById('new-p-materno').value = p.apMaterno || '';
    
    // Formatear fecha para input date
    let fecha = p.alta || '';
    if(!isNaN(fecha) && fecha !== '') {
        const dateObj = new Date(Math.round((Number(fecha) - 25569) * 86400 * 1000));
        fecha = dateObj.toISOString().split('T')[0];
    } else if (fecha.includes('/')) {
        const [d,m,y] = fecha.split('/');
        fecha = `${y}-${m}-${d}`;
    }
    document.getElementById('new-p-alta').value = fecha;

    // Llenar selects encadenados
    updateNewPSelects();
    document.getElementById('new-p-unidad').value = p.unidad;
    updateNewPSelects('area');
    document.getElementById('new-p-area').value = p.area;
    updateNewPSelects('depto');
    document.getElementById('new-p-depto').value = p.depto;
};

window.openWorkerDetail = (ficha) => {
    const p = appData.personal.find(pers => pers.ficha == ficha);
    if(!p) return;

    const modal = document.getElementById('worker-detail-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('wd-avatar').innerText = p.nombre.charAt(0);
    document.getElementById('wd-name').innerText = `${p.nombre} ${p.apPaterno} ${p.apMaterno || ''}`;
    document.getElementById('wd-ficha-display').innerText = `FICHA: ${p.ficha}`;
    document.getElementById('wd-unidad').innerText = p.unidad || 'N/A';
    document.getElementById('wd-area-depto').innerText = `${p.area} / ${p.depto}`;
    document.getElementById('wd-alta').innerText = p.alta || 'N/A';

    // Buscar historial en matrices
    const history = [];
    let totalHrs = 0;
    appData.matrices.forEach(m => {
        const att = m.attendance ? (m.attendance[p.ficha] || {}) : {};
        Object.keys(att).forEach(topicCode => {
            if(att[topicCode].status === 'finished') {
                const catItem = appData.catalogo.find(c => c.codigo === topicCode);
                const hrs = parseFloat(att[topicCode].hours) || 0;
                totalHrs += hrs;
                history.push({
                    date: att[topicCode].date || 'S/F',
                    theme: catItem ? catItem.nombre : topicCode,
                    category: catItem ? catItem.categoria : 'General',
                    hours: hrs,
                    status: 'FINALIZADO'
                });
            }
        });
    });

    document.getElementById('wd-total-hours').innerText = `${totalHrs} HRS`;
    document.getElementById('wd-history-list').innerHTML = history.length ? history.sort((a,b) => new Date(b.date) - new Date(a.date)).map(h => `
        <tr class="text-[10px] hover:bg-slate-50 transition-colors">
            <td class="p-4 font-bold text-slate-500">${h.date}</td>
            <td class="p-4 font-black text-slate-900 uppercase">${h.theme}</td>
            <td class="p-4 font-bold text-blue-600 uppercase">${h.category}</td>
            <td class="p-4 font-black text-indigo-600">${h.hours}</td>
            <td class="p-4">
                <span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-black text-[8px] uppercase">Finalizado</span>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="5" class="p-10 text-center text-[10px] text-slate-400 font-bold uppercase">No hay capacitaciones registradas</td></tr>';

    lucide.createIcons();
};

window.closeWorkerDetail = () => {
    document.getElementById('worker-detail-modal').classList.add('hidden');
};

function savePersonalIndividual() {
    const ficha = document.getElementById('new-p-ficha').value;
    const name = document.getElementById('new-p-nombre').value;
    if(!ficha || !name) return alert("Ficha y Nombre son obligatorios");

    const existingIdx = appData.personal.findIndex(p => p.ficha == ficha);
    
    const newPerson = {
        ficha: ficha,
        nombre: name,
        apPaterno: document.getElementById('new-p-paterno').value,
        apMaterno: document.getElementById('new-p-materno').value,
        alta: document.getElementById('new-p-alta').value,
        unidad: document.getElementById('new-p-unidad').value,
        area: document.getElementById('new-p-area').value,
        depto: document.getElementById('new-p-depto').value,
        perfilAsignado: existingIdx !== -1 ? appData.personal[existingIdx].perfilAsignado : ''
    };

    if(existingIdx !== -1) {
        appData.personal[existingIdx] = newPerson;
    } else {
        appData.personal.push(newPerson);
    }

    save();
    closePersonalModal();
}

function saveCatalogoItem() {
    const code = document.getElementById('cat-code').value;
    const areaSelect = document.getElementById('cat-area').value;
    const newArea = document.getElementById('cat-new-area').value;
    const fileInput = document.getElementById('cat-file-upload');
    
    const item = {
        codigo: code,
        categoria: document.getElementById('cat-category').value,
        areaAplica: areaSelect === 'NUEVA AREA' ? newArea : areaSelect,
        nombre: document.getElementById('cat-name').value,
        descripcion: document.getElementById('cat-desc').value,
        instructor: document.getElementById('cat-instructor').value,
        archivo: 'PDF',
        fileName: fileInput.files[0] ? fileInput.files[0].name : (currentEditCatIdx !== null ? appData.catalogo[currentEditCatIdx].fileName : ''),
        fileData: currentEditFileData || (currentEditCatIdx !== null ? appData.catalogo[currentEditCatIdx].fileData : null)
    };
    
    if(!item.nombre || !item.codigo) return alert("Código y Nombre son obligatorios");
    if(areaSelect === 'NUEVA AREA' && !newArea) return alert("Especifique el nombre de la nueva área");
    
    if(currentEditCatIdx !== null) {
        appData.catalogo[currentEditCatIdx] = item;
    } else {
        appData.catalogo.push(item);
    }
    
    save();
    closeCatalogoModal();
}

function deleteCatalogoItem(idx) {
    if(confirm('¿Eliminar este registro del catálogo?')) {
        appData.catalogo.splice(idx, 1);
        save();
    }
}

        function viewCatalogoFile(idx) {
            const item = appData.catalogo[idx];
            if(!item.fileName) return alert("No hay ningún archivo vinculado a este registro.");
            
            const m = document.getElementById('preview-modal');
            const frame = document.getElementById('prev-frame');
            const placeholder = document.getElementById('prev-placeholder');
            const downloadBtn = document.getElementById('prev-download-btn');
            
            m.classList.remove('hidden');
            document.getElementById('prev-title').innerText = item.nombre;
            document.getElementById('prev-meta').innerText = `ÁREA: ${item.areaAplica} | COD: ${item.codigo}`;
            
            if(item.fileData) {
                frame.classList.remove('hidden');
                placeholder.classList.add('hidden');
                frame.src = item.fileData;
                downloadBtn.onclick = () => {
                    const link = document.createElement('a');
                    link.href = item.fileData;
                    link.download = item.fileName;
                    link.click();
                };
            } else {
                frame.classList.add('hidden');
                placeholder.classList.remove('hidden');
                frame.src = "about:blank";
                downloadBtn.onclick = () => alert("No hay datos de archivo para descargar.");
            }
            lucide.createIcons();
        }

        function closePreviewModal() { 
            document.getElementById('preview-modal').classList.add('hidden'); 
            document.getElementById('prev-frame').src = "about:blank";
        }

    // --- MATRICES DE CAPACITACIÓN ---
    function renderMatricesHierarchy() {
        const container = document.getElementById('matrices-hierarchy');
        if(!container) return;
        container.innerHTML = '';

        const yearFilter = document.getElementById('matrix-year-filter').value;

        // Filtrar estructura por permisos de usuario
        const units = appData.unidades.filter(u => currentUser.role === 'ADMIN' || currentUser.unidad === 'ALL' || u.name === currentUser.unidad);

        units.forEach(unit => {
            const unitAreas = appData.areas.filter(a => a.unitId === unit.id && (currentUser.role === 'ADMIN' || currentUser.area === 'ALL' || a.name === currentUser.area));
            if(unitAreas.length === 0 && currentUser.role !== 'ADMIN') return;
            
            const areaElements = unitAreas.map(a => renderAreaMatriz(a)).join('');
            container.innerHTML += `
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-6">
                    <div class="bg-slate-900 p-4 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <i data-lucide="building-2" size="18" class="text-blue-400"></i>
                            <h3 class="text-xs font-black text-white uppercase tracking-widest">${unit.name}</h3>
                        </div>
                    </div>
                    <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/50">
                        ${areaElements}
                    </div>
                </div>
            `;
        });
        lucide.createIcons();
    }

    function renderAreaMatriz(a) {
        const deptos = appData.departamentos.filter(d => d.areaId === a.id && (currentUser.role === 'ADMIN' || currentUser.depto === 'ALL' || d.name === currentUser.depto));
        if(deptos.length === 0 && currentUser.role !== 'ADMIN') return '';
        return `
            <div class="space-y-3">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                        <h4 class="text-[10px] font-black text-slate-800 uppercase tracking-tighter">${a.name}</h4>
                    </div>
                </div>
                ${deptos.map(d => renderDeptoMatriz(d)).join('')}
            </div>
        `;
    }

    function renderDeptoMatriz(d) {
        const yearFilter = document.getElementById('matrix-year-filter');
        const selectedYear = yearFilter ? yearFilter.value : new Date().getFullYear().toString();

        const deptMatrices = appData.matrices.filter(m => {
            const isDepto = m.depto === d.name;
            const mYear = new Date(m.start + 'T00:00:00').getFullYear().toString();
            return isDepto && mYear === selectedYear;
        });
        return `
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all">
                <div class="flex justify-between items-start mb-4">
                    <h5 class="text-[11px] font-bold text-slate-900 uppercase leading-tight">${d.name}</h5>
                    <button onclick="openMatrizModal('${d.name}')" class="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                        <i data-lucide="plus" size="12"></i>
                    </button>
                </div>
                <div class="space-y-3">
                    ${deptMatrices.length ? deptMatrices.map(m => {
                        const kpis = calculateMatrixKPIs(m);
                        return `
                        <div class="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-blue-200 transition-all group">
                            <div class="flex items-center gap-4 cursor-pointer flex-1" onclick="openMatrizDetail('${m.id}')">
                                <div class="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-blue-600 shadow-sm">
                                    <i data-lucide="table-2" size="14"></i>
                                </div>
                                <div>
                                    <div class="text-[10px] font-black text-slate-700 uppercase">${m.name}</div>
                                    <div class="text-[8px] font-bold text-slate-400 uppercase">${m.category} | ${kpis.topicsCount} TEMAS</div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-6 px-4">
                                <div class="text-right">
                                    <div class="text-[7px] font-black text-slate-400 uppercase tracking-widest">Cumplimiento</div>
                                    <div class="text-[10px] font-black ${kpis.compliance === 100 ? 'text-emerald-600' : 'text-blue-600'}">${kpis.compliance}%</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-[7px] font-black text-slate-400 uppercase tracking-widest">Ejecutado</div>
                                    <div class="text-[10px] font-black text-slate-700">${kpis.hours} HRS</div>
                                </div>
                                <button onclick="deleteMatriz('${m.id}')" class="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                    <i data-lucide="trash-2" size="14"></i>
                                </button>
                            </div>
                        </div>
                        `;
                    }).join('') : '<div class="text-[8px] text-slate-300 font-bold uppercase tracking-widest text-center py-2 border border-dashed border-slate-100 rounded-lg">Sin Matrices</div>'}
                </div>
            </div>
        `;
    }

    function openMatrizModal(deptoName) {
        const m = document.getElementById('matriz-modal');
        m.classList.remove('hidden');
        document.getElementById('matriz-depto').value = deptoName;
        document.getElementById('matriz-name').value = '';
        document.getElementById('matriz-start').value = new Date().toISOString().split('T')[0];
        document.getElementById('matriz-end').value = '';
        document.getElementById('matriz-category').value = 'Procedimiento';
    }

    function closeMatrizModal() { document.getElementById('matriz-modal').classList.add('hidden'); }

    function saveMatriz() {
        const matriz = {
            id: 'MAT-' + Date.now(),
            depto: document.getElementById('matriz-depto').value,
            name: document.getElementById('matriz-name').value,
            start: document.getElementById('matriz-start').value,
            end: document.getElementById('matriz-end').value,
            category: document.getElementById('matriz-category').value,
            items: []
        };
        if(!matriz.name) return alert("El nombre de la matriz es obligatorio");
        appData.matrices.push(matriz);
        save();
        closeMatrizModal();
    }

    function deleteMatriz(id) {
        if(confirm('¿Eliminar esta matriz de capacitación?')) {
            appData.matrices = appData.matrices.filter(m => m.id !== id);
            save();
        }
    }

    // --- GESTIÓN DE ÁREAS Y DEPTOS ---
    window.openAreaModal = (unitId) => {
        currentActiveUnitId = unitId;
        document.getElementById('new-area-name').value = '';
        document.getElementById('area-modal').classList.remove('hidden');
    };
    window.closeAreaModal = () => document.getElementById('area-modal').classList.add('hidden');
    window.saveArea = () => {
        const name = document.getElementById('new-area-name').value;
        if(!name) return alert("Nombre obligatorio");
        const id = 'area_' + Date.now();
        appData.areas.push({ id, unitId: currentActiveUnitId, name });
        save();
        renderMatricesHierarchy();
        closeAreaModal();
    };

    window.openDeptoModal = (areaId) => {
        currentActiveAreaId = areaId;
        document.getElementById('new-depto-name').value = '';
        document.getElementById('depto-modal').classList.remove('hidden');
    };
    window.closeDeptoModal = () => document.getElementById('depto-modal').classList.add('hidden');
    window.saveDepto = () => {
        const name = document.getElementById('new-depto-name').value;
        if(!name) return alert("Nombre obligatorio");
        appData.departamentos.push({ areaId: currentActiveAreaId, name });
        save();
        renderMatricesHierarchy();
        closeDeptoModal();
    };

    // --- DETALLE DE MATRIZ (PERSONAL VS TEMAS) ---
    function openMatrizDetail(id) {
        currentActiveMatrizId = id;
        const matriz = appData.matrices.find(m => m.id === id);
        if(!matriz) return;
        
        showView('matriz-detalle');
        document.getElementById('det-matriz-name').innerText = matriz.name;
        document.getElementById('det-matriz-meta').innerText = `DEPTO: ${matriz.depto} | CATEGORÍA: ${matriz.category}`;
        renderMatrizTable(matriz);
    }

    function renderMatrizTable(matriz) {
        const personnel = appData.personal.filter(p => p.depto === matriz.depto);
        const selectedTopics = (matriz.topics || []).map(topicObj => {
            const isObj = typeof topicObj === 'object' && topicObj !== null;
            const code = isObj ? topicObj.code : topicObj;
            const catalogItem = appData.catalogo.find(c => c.codigo === code);
            
            if(!catalogItem) return null;
            // Normalizamos a objeto y mezclamos
            const normalized = isObj ? topicObj : { code: code, date: '', duration: '' };
            return { ...catalogItem, ...normalized };
        }).filter(Boolean);
        
        const head = document.getElementById('det-matriz-head');
        const body = document.getElementById('det-matriz-body');
        
        // --- CALCULO DE KPIs REFINADOS ---
        let totalProgCount = 0;
        let totalDoneCount = 0;
        let totalProgHours = 0;
        let totalExecHours = 0;
        
        // KPIs Mensuales
        const currentMonth = new Date().getMonth();
        let monthProgCount = 0;
        let monthDoneCount = 0;
        
        personnel.forEach(p => {
            const att = matriz.attendance ? (matriz.attendance[p.ficha] || {}) : {};
            selectedTopics.forEach(t => {
                const topicAtt = att[t.codigo] || {};
                const tDate = t.date ? new Date(t.date + 'T00:00:00') : null;
                const isCurrentMonth = tDate && tDate.getMonth() === currentMonth;
                const duration = parseFloat(t.duration || 0);

                if(topicAtt.status === 'programmed') {
                    totalProgCount++;
                    totalProgHours += duration;
                    if(isCurrentMonth) monthProgCount++;
                } else if(topicAtt.status === 'finished') {
                    totalDoneCount++;
                    totalExecHours += parseFloat(topicAtt.hours || 0);
                    // Los terminados también cuentan como programados originalmente
                    totalProgCount++;
                    totalProgHours += duration;
                    
                    if(isCurrentMonth) {
                        monthProgCount++;
                        monthDoneCount++;
                    }
                }
            });
        });
        
        document.getElementById('kpi-compliance').innerText = totalProgCount ? Math.round((totalDoneCount/totalProgCount)*100) + '%' : '0%';
        document.getElementById('kpi-compliance-month').innerText = monthProgCount ? Math.round((monthDoneCount/monthProgCount)*100) + '%' : '0%';
        document.getElementById('kpi-hours-prog').innerText = totalProgHours.toFixed(1);
        document.getElementById('kpi-hours-exec').innerText = totalExecHours.toFixed(1);
        document.getElementById('bulk-action-btn').classList.toggle('hidden', selectedPersonnelIds.length === 0);


        // Header
        head.innerHTML = `
            <tr>
                <th class="p-4 text-left border-r border-slate-100 min-w-[240px] sticky-header">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" onchange="toggleSelectAllPersonnel(this)" class="w-4 h-4 rounded border-slate-300">
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal del Área</div>
                    </div>
                </th>
                ${selectedTopics.map((t, idx) => `
                    <th class="p-4 text-center border-r border-slate-100 min-w-[180px] bg-white">
                        <div class="mb-3 space-y-2">
                            <div id="month-label-${idx}" class="text-[9px] font-black text-blue-500 mb-1 h-3">${getMonthName(t.date)}</div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[8px] font-black text-slate-400 uppercase text-left">Programación</label>
                                <input type="date" value="${t.date || ''}" 
                                    oninput="updateTopicSchedule('${idx}', 'date', this.value); updateMonthLabel(this, '${idx}')" 
                                    class="header-input w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold outline-none focus:border-blue-500">
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[8px] font-black text-slate-400 uppercase text-left">Duración (Hrs)</label>
                                <input type="text" value="${t.duration || ''}" 
                                    oninput="updateTopicSchedule('${idx}', 'duration', this.value)" 
                                    placeholder="ej. 2 hrs" 
                                    class="header-input w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold outline-none focus:border-blue-500">
                            </div>
                        </div>
                        <div class="h-px bg-slate-100 w-full mb-3"></div>
                        <div class="text-[9px] font-black text-blue-600 uppercase leading-tight mb-1">${t.nombre}</div>
                        <div class="text-[8px] font-bold text-slate-300">${t.codigo}</div>
                    </th>
                `).join('')}
            </tr>
        `;
        
        // Body
        body.innerHTML = personnel.length ? personnel.map(p => {
            const personAttendance = matriz.attendance ? (matriz.attendance[p.ficha] || {}) : {};
            const isSelected = selectedPersonnelIds.includes(p.ficha.toString());
            
            return `
            <tr class="hover:bg-slate-50 transition-all ${isSelected ? 'bg-blue-50/30' : ''}">
                <td class="p-4 border-r border-slate-100 sticky-col">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="togglePersonnelSelection('${p.ficha}')" class="w-4 h-4 rounded border-slate-300">
                        <div>
                            <div class="text-[10px] font-black text-slate-800 uppercase">${p.nombre} ${p.apPaterno}</div>
                            <div class="text-[8px] text-slate-400 font-bold uppercase tracking-widest">FICHA: ${p.ficha}</div>
                        </div>
                    </div>
                </td>
                ${selectedTopics.map(t => {
                    const att = personAttendance[t.codigo] || { status: null };
                    const status = att.status || null;
                    let bgColor = 'bg-white border-slate-100 text-transparent';
                    
                    if(status === 'programmed') bgColor = 'bg-amber-400 border-amber-400 text-white';
                    if(status === 'not_apply') bgColor = 'bg-rose-500 border-rose-500 text-white';
                    if(status === 'finished') bgColor = 'bg-emerald-500 border-emerald-500 text-white';
                    
                    return `
                    <td class="p-4 border-r border-slate-100">
                        <div class="flex items-center justify-center gap-2">
                            <div class="flex flex-col gap-1">
                                <div onclick="setAttendanceStatus('${p.ficha}', '${t.codigo}', 'programmed')" class="w-2.5 h-2.5 rounded-full bg-amber-400 cursor-pointer hover:scale-125 transition-transform shadow-sm"></div>
                                <div onclick="setAttendanceStatus('${p.ficha}', '${t.codigo}', 'not_apply')" class="w-2.5 h-2.5 rounded-full bg-rose-500 cursor-pointer hover:scale-125 transition-transform shadow-sm"></div>
                                <div onclick="setAttendanceStatus('${p.ficha}', '${t.codigo}', 'finished')" class="w-2.5 h-2.5 rounded-full bg-emerald-500 cursor-pointer hover:scale-125 transition-transform shadow-sm"></div>
                                <div onclick="setAttendanceStatus('${p.ficha}', '${t.codigo}', null)" class="w-2.5 h-2.5 rounded-full bg-slate-200 cursor-pointer hover:scale-125 transition-transform shadow-sm"></div>
                            </div>
                            <div class="w-10 h-10 border-2 rounded-xl flex items-center justify-center transition-all ${bgColor}">
                                <i data-lucide="${status === 'not_apply' ? 'slash' : 'check'}" size="18"></i>
                            </div>
                        </div>
                    </td>
                    `;
                }).join('')}
            </tr>
            `;
        }).join('') : `<tr><td colspan="${selectedTopics.length + 1}" class="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">No hay personal asignado</td></tr>`;
        
        lucide.createIcons();
    }

    function openAddTopicsModal() {
        const matriz = appData.matrices.find(m => m.id === currentActiveMatrizId);
        if(!matriz) return;
        
        tempSelectedTopics = [...(matriz.topics || [])];
        const modal = document.getElementById('topics-modal');
        modal.classList.remove('hidden');
        document.getElementById('topics-filter-info').innerText = `Filtrando por: ${matriz.category}`;
        
        renderTopicsList(matriz.category);
    }

    function renderTopicsList(category, filter = '') {
        const list = document.getElementById('topics-list');
        const filtered = appData.catalogo.filter(t => 
            (t.categoria === category) && 
            (t.nombre.toLowerCase().includes(filter.toLowerCase()) || t.codigo.toLowerCase().includes(filter.toLowerCase()))
        );
        
        list.innerHTML = filtered.length ? filtered.map(t => {
            const isSelected = tempSelectedTopics.includes(t.codigo);
            return `
                <div onclick="toggleTopicSelection('${t.codigo}')" class="p-3 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-50 hover:border-slate-200'}">
                    <div>
                        <div class="text-[10px] font-black text-slate-900 uppercase">${t.nombre}</div>
                        <div class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">${t.codigo} | ${t.areaAplica || 'GENERAL'}</div>
                    </div>
                    <div class="w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white' : 'border-2 border-slate-100'}">
                        <i data-lucide="${isSelected ? 'check' : 'plus'}" size="12"></i>
                    </div>
                </div>
            `;
        }).join('') : '<p class="p-8 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No se encontraron temas en esta categoría</p>';
        
        lucide.createIcons();
    }

    window.toggleTopicSelection = (code) => {
        if(tempSelectedTopics.includes(code)) {
            tempSelectedTopics = tempSelectedTopics.filter(c => c !== code);
        } else {
            tempSelectedTopics.push(code);
        }
        const matriz = appData.matrices.find(m => m.id === currentActiveMatrizId);
        renderTopicsList(matriz.category, document.getElementById('topic-search').value);
    };

    document.getElementById('topic-search').oninput = (e) => {
        const matriz = appData.matrices.find(m => m.id === currentActiveMatrizId);
        renderTopicsList(matriz.category, e.target.value);
    };

    function closeTopicsModal() { document.getElementById('topics-modal').classList.add('hidden'); }

    function saveSelectedTopics() {
        syncHeaderData();
        const idx = appData.matrices.findIndex(m => m.id === currentActiveMatrizId);
        if(idx !== -1) {
            appData.matrices[idx].topics = tempSelectedTopics.map(code => {
                const existing = appData.matrices[idx].topics?.find(t => (t.code || t) === code);
                return typeof existing === 'object' ? existing : { code: code, date: '', duration: '' };
            });
            save();
            renderMatrizTable(appData.matrices[idx]);
            closeTopicsModal();
        }
    }

    window.updateTopicSchedule = (idx, field, value) => {
        const mIdx = appData.matrices.findIndex(m => m.id === currentActiveMatrizId);
        if(mIdx !== -1) {
            if(!appData.matrices[mIdx].topics[idx]) return;
            appData.matrices[mIdx].topics[idx][field] = value;
            save(); 
        }
    };

    window.updateMonthLabel = (input, idx) => {
        const label = document.getElementById(`month-label-${idx}`);
        if(label) {
            const dateStr = input.value;
            if(!dateStr) {
                label.innerText = 'SIN FECHA';
                return;
            }
            const date = new Date(dateStr + 'T00:00:00');
            label.innerText = date.toLocaleString('es-MX', { month: 'long' }).toUpperCase();
        }
    };

    function syncHeaderData() {
        const mIdx = appData.matrices.findIndex(m => m.id === currentActiveMatrizId);
        if(mIdx === -1) return;
        const inputs = document.querySelectorAll('.header-input');
        
        // Sincronización robusta basada en la estructura actual de topics
        appData.matrices[mIdx].topics = appData.matrices[mIdx].topics.map((topic, i) => {
            const isObj = typeof topic === 'object' && topic !== null;
            const normalized = isObj ? topic : { code: topic, date: '', duration: '' };
            
            // Cada topic tiene 2 inputs (fecha y duracion)
            const dateInput = inputs[i * 2];
            const durInput = inputs[i * 2 + 1];
            
            if(dateInput) normalized.date = dateInput.value;
            if(durInput) normalized.duration = durInput.value;
            
            return normalized;
        });
        save();
    }

    window.setAttendanceStatus = (ficha, topicCode, status) => {
        syncHeaderData();
        const mIdx = appData.matrices.findIndex(m => m.id === currentActiveMatrizId);
        if(mIdx === -1) return;
        
        if(!appData.matrices[mIdx].attendance) appData.matrices[mIdx].attendance = {};
        if(!appData.matrices[mIdx].attendance[ficha]) appData.matrices[mIdx].attendance[ficha] = {};
        
        if(status === 'finished') {
            openEvidenceModal(ficha, topicCode);
            return;
        }
        
        appData.matrices[mIdx].attendance[ficha][topicCode] = { status: status };
        save();
        renderMatrizTable(appData.matrices[mIdx]);
    };

    function openEvidenceModal(ficha, topicCode, bulk = false) {
        evidenceTarget = { ficha, topicCode, bulk };
        const m = document.getElementById('evidence-modal');
        m.classList.remove('hidden');
        
        if(bulk) {
            document.getElementById('ev-target-name').innerText = `${selectedPersonnelIds.length} PERSONAS SELECCIONADAS`;
        } else {
            const p = appData.personal.find(pers => pers.ficha == ficha);
            document.getElementById('ev-target-name').innerText = p ? `${p.nombre} ${p.apPaterno}` : 'PERSONAL';
        }
        
        document.getElementById('ev-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('ev-hours').value = '';
        document.getElementById('ev-file').value = '';
        document.getElementById('ev-file-label').innerText = 'SELECCIONAR ARCHIVO';
    }

    function closeEvidenceModal() { document.getElementById('evidence-modal').classList.add('hidden'); }

    function updateEvidenceLabel(input) {
        if(input.files && input.files[0]) {
            document.getElementById('ev-file-label').innerText = input.files[0].name.toUpperCase();
        }
    }

    function saveEvidence() {
        syncHeaderData();
        const mIdx = appData.matrices.findIndex(m => m.id === currentActiveMatrizId);
        if(mIdx === -1) return;
        
        const date = document.getElementById('ev-date').value;
        const hours = document.getElementById('ev-hours').value;
        if(!date || !hours) return alert("Fecha y Horas son obligatorias");
        
        const evidenceData = {
            status: 'finished',
            date: date,
            hours: hours,
            evidenceName: document.getElementById('ev-file').files[0]?.name || 'S/E'
        };
        
        if(evidenceTarget.bulk) {
            const topicCode = prompt("Ingrese el Código del Tema para cierre masivo:", "");
            if(!topicCode) return;
            selectedPersonnelIds.forEach(ficha => {
                if(!appData.matrices[mIdx].attendance[ficha]) appData.matrices[mIdx].attendance[ficha] = {};
                appData.matrices[mIdx].attendance[ficha][topicCode] = evidenceData;
            });
        } else {
            appData.matrices[mIdx].attendance[evidenceTarget.ficha][evidenceTarget.topicCode] = evidenceData;
        }
        
        save();
        renderMatrizTable(appData.matrices[mIdx]);
        closeEvidenceModal();
    }

    window.togglePersonnelSelection = (ficha) => {
        syncHeaderData();
        const fichaStr = ficha.toString();
        if(selectedPersonnelIds.includes(fichaStr)) {
            selectedPersonnelIds = selectedPersonnelIds.filter(f => f !== fichaStr);
        } else {
            selectedPersonnelIds.push(fichaStr);
        }
        const matriz = appData.matrices.find(m => m.id === currentActiveMatrizId);
        renderMatrizTable(matriz);
    };

    window.toggleSelectAllPersonnel = (el) => {
        syncHeaderData();
        const matriz = appData.matrices.find(m => m.id === currentActiveMatrizId);
        const personnel = appData.personal.filter(p => p.depto === matriz.depto);
        selectedPersonnelIds = el.checked ? personnel.map(p => p.ficha.toString()) : [];
        renderMatrizTable(matriz);
    };


    function openBulkEvidenceModal() {
        if(selectedPersonnelIds.length === 0) return alert("Seleccione al menos una persona");
        openEvidenceModal(null, null, true);
    }

function importCatalogoFromExcel(ev) {
    const r = new FileReader();
    r.onload = (e) => {
        const b = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
        const raw = XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]]);
        const newItems = raw.map(row => ({
            codigo: row.codigo || row.Codigo || '',
            nombre: row.nombre || row.Nombre || '',
            descripcion: row.descripcion || row.Descripcion || '',
            categoria: row.categoria || row.Categoria || 'Procedimiento',
            instructor: row.instructor || row.Instructor || '',
            archivo: row.archivo || row.Archivo || 'PDF'
        }));
        appData.catalogo = [...appData.catalogo, ...newItems];
        save();
        alert(`¡Carga masiva exitosa! Se han añadido ${newItems.length} temas al catálogo.`);
    };
    r.readAsArrayBuffer(ev.target.files[0]);
}

    window.openAIAudit = () => {
        const monthFilter = document.getElementById('dash-month-filter').value;
        const globalKPIs = calculateGlobalKPIs(monthFilter);
        const container = document.getElementById('ai-audit-content');
        
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-6">
                    <div class="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                        <h4 class="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">Análisis de Riesgo Operativo (${monthFilter === 'ALL' ? 'ANUAL' : 'MES SELECCIONADO'})</h4>
                        <p class="text-xs text-slate-600 leading-relaxed font-medium">
                            Basado en el cumplimiento actual del **${globalKPIs.compliance}%**, se detecta un riesgo moderado en la transferencia de conocimiento técnico. Áreas críticas sin capacitación completa representan un cuello de botella para la eficiencia de planta.
                        </p>
                    </div>
                    <div class="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                        <h4 class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">Eficiencia de Ejecución</h4>
                        <p class="text-xs text-slate-600 leading-relaxed font-medium">
                            Se han ejecutado **${globalKPIs.hours} horas** reales. La eficiencia de entrenamiento proyectada es del **${Math.round(globalKPIs.compliance * 1.1)}%** considerando la cobertura de temas críticos.
                        </p>
                    </div>
                </div>
                <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <h4 class="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-4">Recomendaciones Estratégicas</h4>
                    <ul class="space-y-4">
                        <li class="flex gap-3 items-start">
                            <div class="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1"></div>
                            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Priorizar el cierre de brechas en departamentos con cumplimiento menor al 50% para mitigar riesgos de seguridad.</p>
                        </li>
                        <li class="flex gap-3 items-start">
                            <div class="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1"></div>
                            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Aumentar la intensidad de horas en temas de 'Procedimientos Operativos' para elevar el estándar de calidad.</p>
                        </li>
                    </ul>
                </div>
            </div>
            
            <div class="p-8 bg-slate-900 rounded-3xl text-white">
                <div class="flex justify-between items-center mb-6">
                    <h4 class="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Score de Gestión Empresarial</h4>
                    <span class="text-2xl font-black text-white">${Math.round(globalKPIs.compliance * 0.85 + 10)}/100</span>
                </div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div class="bg-indigo-500 h-full transition-all" style="width: ${globalKPIs.compliance}%"></div>
                </div>
            </div>
        `;
        
        document.getElementById('ai-audit-modal').classList.remove('hidden');
        lucide.createIcons();
    };

    window.closeAIAudit = () => { document.getElementById('ai-audit-modal').classList.add('hidden'); };

    function calculateGlobalKPIs(monthFilter = 'ALL') {
        let totalProg = 0, totalDone = 0, totalHours = 0;
        
        appData.matrices.forEach(m => {
            const personnel = appData.personal.filter(p => p.depto === m.depto);
            const selectedTopics = (m.topics || []).map(topicObj => {
                const isObj = typeof topicObj === 'object' && topicObj !== null;
                const code = isObj ? topicObj.code : topicObj;
                const catalogItem = appData.catalogo.find(c => c.codigo === code);
                return catalogItem ? { ...catalogItem, ...(isObj ? topicObj : {}) } : null;
            }).filter(Boolean);

            personnel.forEach(p => {
                const att = m.attendance ? (m.attendance[p.ficha] || {}) : {};
                selectedTopics.forEach(t => {
                    // Aplicar filtro de mes si no es 'ALL'
                    const tDate = t.date ? new Date(t.date + 'T00:00:00') : null;
                    const tMonth = tDate ? tDate.getMonth().toString() : null;
                    
                    if(monthFilter !== 'ALL' && tMonth !== monthFilter) return;

                    const topicAtt = att[t.codigo] || {};
                    if(topicAtt.status === 'programmed') totalProg++;
                    else if(topicAtt.status === 'finished') {
                        totalProg++;
                        totalDone++;
                        totalHours += parseFloat(topicAtt.hours || 0);
                    }
                });
            });
        });

        return {
            compliance: totalProg ? Math.round((totalDone / totalProg) * 100) : 0,
            hours: totalHours.toFixed(1),
            coverage: totalProg ? Math.round((totalDone / totalProg) * 95) / 100 : 0, // Estimado
            finished: totalDone
        };
    }

    function renderDashboard() {
        const monthFilter = document.getElementById('dash-month-filter').value;
        const kpis = calculateGlobalKPIs(monthFilter);
        
        document.getElementById('dash-compliance').innerText = kpis.compliance + '%';
        document.getElementById('dash-hours').innerText = kpis.hours;
        document.getElementById('dash-coverage').innerText = Math.round(kpis.compliance * 0.9) + '%';
        document.getElementById('dash-finished').innerText = kpis.finished;

        // --- DRILLDOWN JERÁRQUICO COMPLETO ---
        const drilldown = document.getElementById('dash-hierarchy-drilldown');
        drilldown.innerHTML = (appData.unidades || []).map(u => {
            const areas = appData.areas.filter(a => a.unitId === u.id);
            return `
                <div class="space-y-4">
                    <div class="flex justify-between items-center bg-slate-900 p-3 rounded-xl text-white">
                        <span class="text-[9px] font-black uppercase tracking-widest">${u.name}</span>
                        <i data-lucide="building-2" size="12"></i>
                    </div>
                    <div class="pl-4 space-y-4">
                        ${areas.map(a => {
                            const deptos = appData.departamentos.filter(d => d.areaId === a.id);
                            return `
                                <div class="space-y-2">
                                    <div class="text-[8px] font-black text-blue-600 uppercase tracking-widest">${a.name}</div>
                                    <div class="space-y-1.5">
                                        ${deptos.map(d => {
                                            const matrices = appData.matrices.filter(m => m.depto === d.name);
                                            let dProg = 0, dDone = 0;
                                            matrices.forEach(m => {
                                                const mk = calculateMatrixKPIs(m);
                                                dProg += 100; dDone += mk.compliance;
                                            });
                                            const dComp = matrices.length ? Math.round(dDone / matrices.length) : 0;
                                            return `
                                                <div class="flex items-center gap-3">
                                                    <div class="flex-1 text-[9px] font-bold text-slate-500 uppercase truncate">${d.name}</div>
                                                    <div class="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                        <div class="bg-blue-600 h-full" style="width: ${dComp}%"></div>
                                                    </div>
                                                    <span class="text-[9px] font-black text-slate-700 w-8 text-right">${dComp}%</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // --- MAPAS DE CONOCIMIENTO (Heatmaps por Categoría) ---
        const mapContainer = document.getElementById('dash-knowledge-maps');
        const categories = [...new Set(appData.catalogo.map(c => c.categoria))];
        
        mapContainer.innerHTML = categories.map(cat => {
            let catTotal = 0, catDone = 0, count = 0;
            appData.matrices.forEach(m => {
                const mk = calculateMatrixKPIs(m);
                if(m.category === cat || (m.topics || []).some(t => {
                    const ct = appData.catalogo.find(c => c.codigo === (t.code || t));
                    return ct && ct.categoria === cat;
                })) {
                    catTotal += 100;
                    catDone += mk.compliance;
                    count++;
                }
            });
            const catComp = count ? Math.round(catDone / count) : 0;
            const colorClass = catComp > 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                             catComp > 50 ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                             'bg-rose-50 text-rose-600 border-rose-100';

            return `
                <div class="p-4 rounded-2xl border ${colorClass} transition-all hover:scale-[1.02]">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="text-[9px] font-black uppercase tracking-widest">${cat}</h4>
                        <span class="text-[10px] font-black">${catComp}%</span>
                    </div>
                    <div class="text-[8px] font-bold uppercase opacity-70 mb-3">${count} Matrices Analizadas</div>
                    <div class="w-full bg-white/50 h-1 rounded-full overflow-hidden">
                        <div class="${colorClass.split(' ')[1].replace('text', 'bg')} h-full" style="width: ${catComp}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    }

    // --- INSTRUCTORES ---
    function renderInstructors() {
        const list = document.getElementById('list-instructores');
        if(!list) return;
        list.innerHTML = (appData.instructors || []).map((ins, idx) => `
            <tr class="hover:bg-slate-50 transition-colors text-xs">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">${ins.name.charAt(0)}</div>
                        <span class="font-black text-slate-900 uppercase">${ins.name}</span>
                    </div>
                </td>
                <td class="p-4 font-bold text-slate-500 uppercase">${ins.specialty}</td>
                <td class="p-4">
                    <div class="flex flex-wrap gap-1">
                        ${(ins.topicsIds || []).map(tid => {
                            const topic = appData.catalogo.find(c => c.codigo === tid);
                            return `<span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">${topic ? topic.nombre : tid}</span>`;
                        }).join('')}
                    </div>
                </td>
                <td class="p-4 text-center">
                    <span class="font-black text-indigo-600">${(ins.files || []).length} Materiales</span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2">
                        ${currentUser.role === 'ADMIN' ? `
                            <button onclick="openInstructorModal('${ins.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><i data-lucide="edit-3" size="14"></i></button>
                            <button onclick="deleteInstructor('${ins.id}')" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><i data-lucide="trash-2" size="14"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    let currentInsFiles = [];
    window.openInstructorModal = (id = null) => {
        const modal = document.getElementById('instructor-modal');
        modal.classList.remove('hidden');
        const picker = document.getElementById('ins-topics-picker');
        picker.innerHTML = appData.catalogo.map(c => `
            <label class="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl cursor-pointer hover:border-indigo-400 transition-all">
                <input type="checkbox" value="${c.codigo}" class="ins-topic-check w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                <div class="flex-1">
                    <div class="text-[10px] font-black text-slate-800 uppercase">${c.nombre}</div>
                    <div class="text-[8px] text-slate-400 font-bold uppercase">${c.codigo} | ${c.categoria}</div>
                </div>
            </label>
        `).join('');

        if(id) {
            const ins = appData.instructors.find(i => i.id === id);
            document.getElementById('ins-name').value = ins.name;
            document.getElementById('ins-specialty').value = ins.specialty;
            const checks = document.querySelectorAll('.ins-topic-check');
            checks.forEach(ch => {
                if(ins.topicsIds.includes(ch.value)) ch.checked = true;
            });
            currentInsFiles = [...(ins.files || [])];
            window.editingInstructorId = id;
        } else {
            document.getElementById('ins-name').value = '';
            document.getElementById('ins-specialty').value = '';
            currentInsFiles = [];
            window.editingInstructorId = null;
        }
        renderInsFilesList();
    };

    window.handleInstructorFiles = (el) => {
        const files = Array.from(el.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentInsFiles.push({
                    name: file.name,
                    type: file.type,
                    data: e.target.result
                });
                renderInsFilesList();
            };
            reader.readAsDataURL(file);
        });
    };

    function renderInsFilesList() {
        const list = document.getElementById('ins-files-list');
        list.innerHTML = currentInsFiles.map((f, i) => `
            <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                <div class="flex items-center gap-3">
                    <i data-lucide="file-text" size="14" class="text-indigo-600"></i>
                    <span class="text-[10px] font-bold text-slate-700 uppercase truncate max-w-[200px]">${f.name}</span>
                </div>
                <button onclick="currentInsFiles.splice(${i},1); renderInsFilesList();" class="text-rose-500 hover:text-rose-700"><i data-lucide="x" size="14"></i></button>
            </div>
        `).join('');
        lucide.createIcons();
    }

    window.saveInstructor = () => {
        const name = document.getElementById('ins-name').value;
        const specialty = document.getElementById('ins-specialty').value;
        const selectedTopics = Array.from(document.querySelectorAll('.ins-topic-check:checked')).map(ch => ch.value);

        if(!name) return alert("Nombre es obligatorio");

        const insData = {
            id: window.editingInstructorId || Date.now().toString(),
            name,
            specialty,
            topicsIds: selectedTopics,
            files: currentInsFiles
        };

        if(window.editingInstructorId) {
            const idx = appData.instructors.findIndex(i => i.id === window.editingInstructorId);
            appData.instructors[idx] = insData;
        } else {
            appData.instructors.push(insData);
        }
        
        save();
        closeInstructorModal();
    };

    window.closeInstructorModal = () => document.getElementById('instructor-modal').classList.add('hidden');
    window.deleteInstructor = (id) => { if(confirm('¿Eliminar instructor?')) { appData.instructors = appData.instructors.filter(i => i.id !== id); save(); } };

function showView(id, el) {
    if(!currentUser) return;
    
    // Forzar visibilidad de menús admin si el rol es correcto
    if(currentUser.role === 'ADMIN') {
        const am = document.getElementById('admin-menu');
        if(am) am.classList.remove('hidden');
    }

    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const targetView = document.getElementById('view-' + id);
    if(targetView) targetView.classList.add('active');
    
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    
    if(id === 'dashboard') renderDashboard();
    if(id === 'matrices') renderMatricesHierarchy();
    if(id === 'instructores') renderInstructors();
    if(id === 'personal') renderPersonal();
    if(id === 'estructura') renderEstructura();
    if(id === 'usuarios') renderUsers();
    
    lucide.createIcons();
}

window.openLearningMap = (ficha) => {
    const p = appData.personal.find(pers => pers.ficha == ficha);
    if(!p) return;
    
    const modal = document.getElementById('learning-map-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('lm-name').innerText = `${p.nombre} ${p.apPaterno}`;
    document.getElementById('lm-profile').innerText = `PUESTO: ${p.perfilAsignado || 'NO ASIGNADO'}`;
    document.getElementById('lm-depto').innerText = p.depto || 'SIN DEPTO';
    document.getElementById('lm-avatar').innerText = p.nombre.charAt(0);

    // --- CÁLCULO DE COMPETITIVIDAD ---
    const categories = ["Seguridad", "Tecnico", "Normas", "Salud", "Procedimiento"];
    let totalReq = 0, totalDone = 0;
    const radarData = [];
    
    const statsHtml = categories.map(cat => {
        let catReq = 0, catDone = 0;
        appData.matrices.forEach(m => {
            const att = m.attendance ? (m.attendance[p.ficha] || {}) : {};
            (m.topics || []).forEach(topicObj => {
                const code = typeof topicObj === 'object' ? topicObj.code : topicObj;
                const catItem = appData.catalogo.find(c => c.codigo === code);
                if(catItem && catItem.categoria === cat) {
                    catReq++;
                    if(att[code] && att[code].status === 'finished') catDone++;
                }
            });
        });
        
        totalReq += catReq;
        totalDone += catDone;
        const catScore = catReq ? Math.round((catDone / catReq) * 100) : 0;
        radarData.push(catScore);
        const barColor = catScore > 80 ? 'bg-emerald-500' : catScore > 50 ? 'bg-blue-500' : 'bg-rose-500';

        return `
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">${cat}</span>
                    <span class="text-[10px] font-black text-slate-900">${catScore}%</span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div class="${barColor} h-full transition-all duration-1000" style="width: ${catScore}%"></div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('lm-stats').innerHTML = statsHtml;
    const totalScore = totalReq ? Math.round((totalDone / totalReq) * 100) : 0;
    document.getElementById('lm-total-score').innerText = totalScore + '%';
    document.getElementById('lm-finished-count').innerText = totalScore;

    // --- RENDER RADAR CHART (TELARAÑA) ---
    const ctx = document.getElementById('lm-radar-chart').getContext('2d');
    if(window.lmRadar) window.lmRadar.destroy();
    
    window.lmRadar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Dominio Técnico',
                data: radarData,
                fill: true,
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                borderColor: 'rgb(79, 70, 229)',
                pointBackgroundColor: 'rgb(79, 70, 229)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(79, 70, 229)'
            }]
        },
        options: {
            elements: { line: { borderWidth: 3 } },
            scales: { r: { angleLines: { display: false }, suggestMin: 0, suggestMax: 100, ticks: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });

    // --- TIMELINE DE CAPACITACIÓN ---
    const timelineHtml = [];
    appData.matrices.forEach(m => {
        const att = m.attendance ? (m.attendance[p.ficha] || {}) : {};
        Object.keys(att).forEach(code => {
            if(att[code] && att[code].status === 'finished') {
                const topic = appData.catalogo.find(c => c.codigo === code);
                timelineHtml.push({
                    date: att[code].date || 'S/F',
                    name: topic ? topic.nombre : code,
                    hours: att[code].hours || '0',
                    category: topic ? topic.categoria : 'N/A'
                });
            }
        });
    });

    timelineHtml.sort((a,b) => new Date(b.date) - new Date(a.date));
    document.getElementById('lm-timeline').innerHTML = timelineHtml.length ? timelineHtml.map(t => `
        <div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
                <div>
                    <div class="text-[10px] font-black text-slate-900 uppercase">${t.name}</div>
                    <div class="text-[8px] font-bold text-slate-400 uppercase">${t.date} | ${t.category}</div>
                </div>
            </div>
            <div class="text-[9px] font-black text-indigo-600 uppercase">${t.hours} HRS</div>
        </div>
    `).join('') : '<p class="text-[10px] text-slate-400 text-center font-bold uppercase p-8">No hay historial de capacitación finalizada</p>';

    lucide.createIcons();
};

window.closeLearningMap = () => document.getElementById('learning-map-modal').classList.add('hidden');

    // --- AUX PERSONAL ---
    window.openPersonalModal = () => {
        const m = document.getElementById('personal-modal');
        if(!m) return;
        m.classList.remove('hidden');
        document.querySelector('#personal-modal h3').innerText = "Nuevo Trabajador";
        
        // Limpiar campos
        document.getElementById('new-p-ficha').value = '';
        document.getElementById('new-p-ficha').readOnly = false;
        document.getElementById('new-p-nombre').value = '';
        document.getElementById('new-p-paterno').value = '';
        document.getElementById('new-p-materno').value = '';
        document.getElementById('new-p-alta').value = '';
        
        const uS = document.getElementById('new-p-unidad');
        uS.innerHTML = '<option value="">Seleccionar Unidad...</option>' + appData.unidades.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
        document.getElementById('new-p-area').innerHTML = '<option value="">-</option>';
        document.getElementById('new-p-depto').innerHTML = '<option value="">-</option>';
    };

    window.closePersonalModal = () => document.getElementById('personal-modal').classList.add('hidden');

    window.updateNewPSelects = (level) => {
        if(level === 'area') {
            const uVal = document.getElementById('new-p-unidad').value;
            const unit = appData.unidades.find(u => u.name === uVal);
            const aS = document.getElementById('new-p-area');
            if(unit) {
                const areas = appData.areas.filter(a => a.unitId === unit.id);
                aS.innerHTML = '<option value="">Seleccionar Área...</option>' + areas.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
            } else {
                aS.innerHTML = '<option value="">-</option>';
            }
            updateNewPSelects('depto');
        } else if(level === 'depto') {
            const aVal = document.getElementById('new-p-area').value;
            const area = appData.areas.find(a => a.name === aVal);
            const dS = document.getElementById('new-p-depto');
            if(area) {
                const deptos = appData.departamentos.filter(d => d.areaId === area.id);
                dS.innerHTML = '<option value="">Seleccionar Depto...</option>' + deptos.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
            } else {
                dS.innerHTML = '<option value="">-</option>';
            }
        }
    };

    window.savePersonalIndividual = () => {
        const ficha = document.getElementById('new-p-ficha').value.trim();
        const nombre = document.getElementById('new-p-nombre').value;
        const paterno = document.getElementById('new-p-paterno').value;
        const materno = document.getElementById('new-p-materno').value;
        const alta = document.getElementById('new-p-alta').value;
        const unidad = document.getElementById('new-p-unidad').value;
        const area = document.getElementById('new-p-area').value;
        const depto = document.getElementById('new-p-depto').value;

        if(!ficha || !nombre || !paterno) return alert("Ficha, Nombre y Apellido Paterno son obligatorios");

        const existingIdx = appData.personal.findIndex(p => p.ficha.toString().trim() === ficha);
        
        const personData = {
            uid: existingIdx !== -1 ? (appData.personal[existingIdx].uid || Date.now().toString() + Math.random()) : Date.now().toString() + Math.random(),
            ficha, nombre, apPaterno: paterno, apMaterno: materno,
            alta, unidad, area, depto,
            perfilAsignado: existingIdx !== -1 ? appData.personal[existingIdx].perfilAsignado : ''
        };

        if(existingIdx !== -1) {
            appData.personal[existingIdx] = personData;
        } else {
            appData.personal.push(personData);
        }
        
        save();
        closePersonalModal();
    };

    // --- SEGURIDAD Y USUARIOS ---
    window.handleLogin = () => {
        const u = document.getElementById('login-user').value;
        const p = document.getElementById('login-pass').value;
        const user = appData.users.find(usr => usr.user === u && usr.pass === p);
        if(user) {
            currentUser = user;
            sessionStorage.setItem('erp_current_user', JSON.stringify(user));
            document.getElementById('login-screen').classList.add('hidden');
            render();
            showView('dashboard', document.querySelector('.sidebar-item'));
        } else {
            alert("Credenciales incorrectas");
        }
    };

    window.handleLogout = () => {
        sessionStorage.removeItem('erp_current_user');
        location.reload();
    };

    function renderUsers() {
        const list = document.getElementById('list-usuarios');
        if(!list) return;
        list.innerHTML = appData.users.map((u, i) => `
            <tr class="text-xs hover:bg-slate-50 transition-all">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[10px] font-black">${u.nombre.charAt(0)}</div>
                        <span class="font-black text-slate-900 uppercase">${u.nombre}</span>
                    </div>
                </td>
                <td class="p-4 font-bold text-slate-500">${u.user}</td>
                <td class="p-4"><span class="px-2 py-1 ${u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'} rounded-lg font-black text-[9px] uppercase">${u.role}</span></td>
                <td class="p-4 text-[9px] font-bold text-slate-400 uppercase">${u.unidad} / ${u.area} / ${u.depto}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="openEditUserModal('${u.id}')" class="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg" title="Editar Permisos"><i data-lucide="edit-3" size="14"></i></button>
                        ${u.user !== 'admin' ? `<button onclick="deleteUser('${u.id}')" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg" title="Eliminar Usuario"><i data-lucide="trash-2" size="14"></i></button>` : '-'}
                    </div>
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    }

    window.openUserModal = () => {
        window.editingUserId = null;
        document.getElementById('user-modal').classList.remove('hidden');
        document.getElementById('user-modal-title').innerText = "Nuevo Usuario";
        document.getElementById('u-nombre').value = '';
        document.getElementById('u-user').value = '';
        document.getElementById('u-pass').value = '';
        document.getElementById('u-role').value = 'USER';
        
        const uS = document.getElementById('u-unidad');
        uS.innerHTML = '<option value="ALL">Todas las Unidades</option>' + appData.unidades.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
        document.getElementById('u-area').innerHTML = '<option value="ALL">Todas las Áreas</option>';
        document.getElementById('u-depto').innerHTML = '<option value="ALL">Todos los Deptos</option>';
    };

    window.openEditUserModal = (id) => {
        const u = appData.users.find(usr => usr.id === id);
        if(!u) return;

        window.openUserModal();
        window.editingUserId = id;
        document.getElementById('user-modal-title').innerText = "Editar Usuario: " + u.user;
        document.getElementById('u-nombre').value = u.nombre;
        document.getElementById('u-user').value = u.user;
        document.getElementById('u-pass').value = u.pass;
        document.getElementById('u-role').value = u.role;
        document.getElementById('u-unidad').value = u.unidad;
        
        updateUserSelects('area');
        setTimeout(() => {
            document.getElementById('u-area').value = u.area;
            updateUserSelects('depto');
            setTimeout(() => {
                document.getElementById('u-depto').value = u.depto;
            }, 100);
        }, 100);
    };

    window.openUserModalFromWorker = (ficha) => {
        const p = appData.personal.find(pers => pers.ficha == ficha);
        if(!p) return;

        openUserModal();
        document.getElementById('user-modal-title').innerText = "Crear Cuenta: " + p.nombre;
        document.getElementById('u-nombre').value = `${p.nombre} ${p.apPaterno}`;
        document.getElementById('u-unidad').value = p.unidad || 'ALL';
        
        // Cargar Áreas del trabajador
        updateUserSelects('area');
        setTimeout(() => {
            document.getElementById('u-area').value = p.area || 'ALL';
            updateUserSelects('depto');
            setTimeout(() => {
                document.getElementById('u-depto').value = p.depto || 'ALL';
            }, 100);
        }, 100);
    };

    window.closeUserModal = () => document.getElementById('user-modal').classList.add('hidden');

    window.updateUserSelects = (level) => {
        if(level === 'area') {
            const uVal = document.getElementById('u-unidad').value;
            const unit = appData.unidades.find(u => u.name === uVal);
            const aS = document.getElementById('u-area');
            if(unit) {
                const areas = appData.areas.filter(a => a.unitId === unit.id);
                aS.innerHTML = '<option value="ALL">Todas las Áreas</option>' + areas.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
            } else {
                aS.innerHTML = '<option value="ALL">Todas las Áreas</option>';
            }
            updateUserSelects('depto');
        } else if(level === 'depto') {
            const aVal = document.getElementById('u-area').value;
            const area = appData.areas.find(a => a.name === aVal);
            const dS = document.getElementById('u-depto');
            if(area) {
                const deptos = appData.departamentos.filter(d => d.areaId === area.id);
                dS.innerHTML = '<option value="ALL">Todos los Deptos</option>' + deptos.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
            } else {
                dS.innerHTML = '<option value="ALL">Todos los Deptos</option>';
            }
        }
    };

    window.saveUser = () => {
        const nombre = document.getElementById('u-nombre').value;
        const user = document.getElementById('u-user').value;
        const pass = document.getElementById('u-pass').value;
        const role = document.getElementById('u-role').value;
        const unidad = document.getElementById('u-unidad').value;
        const area = document.getElementById('u-area').value;
        const depto = document.getElementById('u-depto').value;

        if(!nombre || !user || !pass) return alert("Todos los campos son obligatorios");

        const userData = {
            id: window.editingUserId || Date.now().toString(),
            nombre, user, pass, role, unidad, area, depto
        };

        if(window.editingUserId) {
            const idx = appData.users.findIndex(usr => usr.id === window.editingUserId);
            appData.users[idx] = userData;
        } else {
            appData.users.push(userData);
        }
        
        save();
        closeUserModal();
    };

    window.deleteUser = (id) => { if(confirm('¿Eliminar usuario?')) { appData.users = appData.users.filter(u => u.id !== id); save(); } };

document.addEventListener('DOMContentLoaded', () => {
    if(currentUser) {
        document.getElementById('login-screen').classList.add('hidden');
        render();
        syncFromCloud(); // Carga inicial
        
        // Sincronización automática cada 30 segundos
        setInterval(() => {
            if(currentUser) syncFromCloud();
        }, 30000);
        
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
    }
    lucide.createIcons();
});
