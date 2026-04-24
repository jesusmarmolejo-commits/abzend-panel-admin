'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const STATUS_LABEL = { pending:'Pendiente', assigned:'Asignado', picked_up:'Recogido', in_transit:'En tránsito', delivered:'Entregado', cancelled:'Cancelado' }
const STATUS_COLOR = { pending:'#FAEEDA', assigned:'#E1F5EE', picked_up:'#E1F5EE', in_transit:'#EFF6FF', delivered:'#DCFCE7', cancelled:'#FEE2E2' }
const STATUS_TEXT  = { pending:'#92400E', assigned:'#065F46', picked_up:'#065F46', in_transit:'#1E40AF', delivered:'#166534', cancelled:'#991B1B' }
const fmtDate = (d) => d ? new Date(d).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}) : '—'
const fmtMoney = (n) => `$${Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2})}`

const RFC_REGEX = /^([A-ZÑ&]{3,4})?(?:- ?)?(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))?(?:- ?)?([A-Z\d]{2})([A\d])$/

const REGIMENES = [
  {id:'601',label:'General de Ley Personas Morales'},
  {id:'603',label:'Personas Morales con Fines no Lucrativos'},
  {id:'605',label:'Sueldos y Salarios'},
  {id:'606',label:'Arrendamiento'},
  {id:'608',label:'Demás ingresos'},
  {id:'609',label:'Consolidación'},
  {id:'610',label:'Residentes en el Extranjero'},
  {id:'611',label:'Ingresos por Dividendos'},
  {id:'612',label:'Personas Físicas con Actividades Empresariales'},
  {id:'614',label:'Ingresos por intereses'},
  {id:'616',label:'Sin obligaciones fiscales'},
  {id:'620',label:'Sociedades Cooperativas de Producción'},
  {id:'621',label:'Incorporación Fiscal'},
  {id:'622',label:'Actividades Agrícolas, Ganaderas, Silvícolas'},
  {id:'623',label:'Opcional para Grupos de Sociedades'},
  {id:'624',label:'Coordinados'},
  {id:'625',label:'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas'},
  {id:'626',label:'Simplificado de Confianza'},
]

const USOS_CFDI = [
  {id:'G01',label:'Adquisición de mercancias'},
  {id:'G02',label:'Devoluciones, descuentos o bonificaciones'},
  {id:'G03',label:'Gastos en general'},
  {id:'I01',label:'Construcciones'},
  {id:'I02',label:'Mobilario y equipo de oficina'},
  {id:'I03',label:'Equipo de transporte'},
  {id:'I04',label:'Equipo de computo'},
  {id:'I08',label:'Otra maquinaria y equipo'},
  {id:'D01',label:'Honorarios médicos y gastos hospitalarios'},
  {id:'D10',label:'Pagos por servicios educativos'},
  {id:'S01',label:'Sin efectos fiscales'},
  {id:'CP01',label:'Pagos'},
  {id:'CN01',label:'Nómina'},
]

const METODOS_PAGO = [
  {id:'PUE',label:'PUE - Pago en una sola exhibición'},
  {id:'PPD',label:'PPD - Pago en parcialidades o diferido'},
]

const FORMAS_PAGO = [
  {id:'01',label:'01 - Efectivo'},
  {id:'02',label:'02 - Cheque nominativo'},
  {id:'03',label:'03 - Transferencia electrónica'},
  {id:'04',label:'04 - Tarjeta de crédito'},
  {id:'28',label:'28 - Tarjeta de débito'},
  {id:'99',label:'99 - Por definir'},
]

const STATUS_CLIENTE_COLOR = {
  pendiente:          {bg:'#FAEEDA', text:'#92400E'},
  activo:             {bg:'#DCFCE7', text:'#166534'},
  bloqueado:          {bg:'#FEE2E2', text:'#991B1B'},
  inactivo:           {bg:'#F3F4F6', text:'#6B7280'},
  situacion_especial: {bg:'#FFF0E0', text:'#C2410C'},
}

const STATUS_CLIENTE_LABEL = {
  pendiente:          'Pendiente',
  activo:             'Activo',
  bloqueado:          'Bloqueado',
  inactivo:           'Inactivo',
  situacion_especial: '⚠️ Situación Especial',
}

const ROLES_LABEL = {
  admin: 'Administrador',
  gerente_finanzas: 'Gerente de Finanzas',
  client: 'Cliente',
  driver: 'Repartidor',
  station: 'Estación',
}

const CLIENTE_FORM_INITIAL = {
  razon_social:'', rfc:'', regimen_fiscal:'601', cp_fiscal:'', uso_cfdi:'G03',
  dias_credito:30, limite_credito:0, metodo_pago:'PPD', forma_pago:'99', moneda:'MXN',
  servicios:'ambos',
  dir_alias:'Bodega Principal', dir_calle:'', dir_num_ext:'', dir_num_int:'',
  dir_colonia:'', dir_cp:'', dir_municipio:'', dir_estado:'',
  con_nombre:'', con_puesto:'', con_email:'', con_telefono:'',
}

export default function AdminPanel() {
  const [section, setSection]   = useState('dashboard')
  const [user, setUser]         = useState(null)
  const [dark, setDark]         = useState(false)
  const [loading, setLoading]   = useState(true)
  const [orders, setOrders]     = useState([])
  const [clients, setClients]   = useState([])
  const [drivers, setDrivers]   = useState([])
  const [statuses, setStatuses] = useState([])
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showOrderMenu, setShowOrderMenu] = useState(false)
  const [assignOrder, setAssignOrder]   = useState(null)
  const [assignDriver, setAssignDriver] = useState('')
  const [assignCode, setAssignCode]     = useState('ASC')
  const [processing, setProcessing]     = useState(false)
  const [statusOrder, setStatusOrder]   = useState(null)
  const [newStatus, setNewStatus]       = useState('')
  const [statusCode, setStatusCode]     = useState('')
  const [quoteDist, setQuoteDist] = useState('')
  const [quoteWeight, setQuoteWeight] = useState('')
  const [quoteResult, setQuoteResult] = useState(null)
  const [msg, setMsg] = useState('')
  const [clientesB2B, setClientesB2B] = useState([])
  const [transportOrders, setTransportOrders] = useState([])
  const [selectedTransport, setSelectedTransport] = useState(null)
  const [transportStatusOrder, setTransportStatusOrder] = useState(null)
  const [newTransportStatus, setNewTransportStatus] = useState('')
  const [assignTransportDriver, setAssignTransportDriver] = useState('')
  const [transportProcessing, setTransportProcessing] = useState(false)
  const [showClienteForm, setShowClienteForm] = useState(false)
  const [clienteForm, setClienteForm] = useState(CLIENTE_FORM_INITIAL)
  const [clienteTab, setClienteTab] = useState('fiscal')
  const [clienteProcessing, setClienteProcessing] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [docFiles, setDocFiles] = useState({csf:null, opinion_32d:null, identificacion:null, acta_constitutiva:null})
  const [rfcError, setRfcError] = useState('')
  const [showSitEspecialModal, setShowSitEspecialModal] = useState(false)
  const [sitEspecialClienteId, setSitEspecialClienteId] = useState(null)
  const [sitEspecialNota, setSitEspecialNota] = useState('')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      const { data: ud } = await sb.from('users').select('role').eq('auth_id', session.user.id).single()
      if (!ud || ud.role !== 'admin') { router.push('/dashboard'); return }
      const { data: st } = await sb.from('shipment_statuses').select('*').order('id')
      setStatuses(st || [])
      if (st?.length) setAssignCode(st.find(s=>s.codigo==='ASC')?.codigo || st[0].codigo)
      await loadAll(sb)
      setLoading(false)
    }
    init()
  }, [])

  const loadAll = async (sb) => {
    const [{ data: ord }, { data: cli }, { data: drv }, { data: b2b }, { data: tOrd }] = await Promise.all([
      sb.from('orders').select('*, client:client_id(full_name,email), driver:driver_id(id,user:user_id(full_name)), events:order_events(status,status_code,created_at)').order('created_at',{ascending:false}),
      sb.from('users').select('*').eq('role','client').order('created_at',{ascending:false}),
      sb.from('drivers').select('*,user:user_id(full_name,email,phone)').order('created_at',{ascending:false}),
      sb.from('clientes').select('*, direcciones:cliente_direcciones(*), contactos:cliente_contactos(*), documentos:cliente_documentos(*), responsable:situacion_especial_por(full_name,email)').order('created_at',{ascending:false}),
      sb.from('transport_orders').select('*, unit:unidad_id(nombre), client:client_id(full_name,email), driver:driver_id(id,user:user_id(full_name)), stops:transport_order_stops(*)').order('created_at',{ascending:false}),
    ])
    setOrders(ord || [])
    setClients(cli || [])
    setDrivers(drv || [])
    setClientesB2B(b2b || [])
    setTransportOrders(tOrd || [])
  }

  const logout = async () => { const sb=createClient(); await sb.auth.signOut(); router.push('/login') }
  const showMsg = (m) => { setMsg(m); setTimeout(()=>setMsg(''),4000) }

  const validateRFC = (rfc) => {
    if (!rfc) return 'RFC requerido'
    if (!RFC_REGEX.test(rfc.toUpperCase())) return 'RFC inválido. Verifica el formato.'
    return ''
  }

  const handleRFCChange = (val) => {
    setClienteForm({...clienteForm, rfc: val.toUpperCase()})
    setRfcError(validateRFC(val))
  }

  const crearCliente = async () => {
    const rfcErr = validateRFC(clienteForm.rfc)
    if (rfcErr) { setRfcError(rfcErr); setClienteTab('fiscal'); return }
    if (!clienteForm.razon_social.trim()) { showMsg('❌ Razón social requerida'); setClienteTab('fiscal'); return }
    if (!clienteForm.cp_fiscal.trim()) { showMsg('❌ CP fiscal requerido'); setClienteTab('fiscal'); return }
    setClienteProcessing(true)
    try {
      const sb = createClient()
      const { data: { user: authUser } } = await sb.auth.getUser()
      const { data: userData } = await sb.from('users').select('id').eq('auth_id', authUser.id).single()
      const { data: clienteData, error: clienteError } = await sb.from('clientes').insert({
        razon_social: clienteForm.razon_social.trim(),
        rfc: clienteForm.rfc.trim(),
        regimen_fiscal: clienteForm.regimen_fiscal,
        cp_fiscal: clienteForm.cp_fiscal.trim(),
        uso_cfdi: clienteForm.uso_cfdi,
        dias_credito: parseInt(clienteForm.dias_credito),
        limite_credito: parseFloat(clienteForm.limite_credito),
        metodo_pago: clienteForm.metodo_pago,
        forma_pago: clienteForm.forma_pago,
        moneda: clienteForm.moneda,
        servicios: clienteForm.servicios,
        vendedor_id: userData.id,
        status: 'pendiente'
      }).select().single()
      if (clienteError) throw clienteError
      const clienteId = clienteData.id
      if (clienteForm.dir_calle.trim()) {
        await sb.from('cliente_direcciones').insert({
          cliente_id: clienteId, alias: clienteForm.dir_alias,
          calle: clienteForm.dir_calle, num_ext: clienteForm.dir_num_ext,
          num_int: clienteForm.dir_num_int, colonia: clienteForm.dir_colonia,
          codigo_postal: clienteForm.dir_cp, municipio: clienteForm.dir_municipio,
          estado: clienteForm.dir_estado, es_principal: true
        })
      }
      if (clienteForm.con_nombre.trim()) {
        await sb.from('cliente_contactos').insert({
          cliente_id: clienteId, nombre: clienteForm.con_nombre,
          puesto: clienteForm.con_puesto, email: clienteForm.con_email,
          telefono: clienteForm.con_telefono, es_principal: true
        })
      }
      for (const [tipo, file] of Object.entries(docFiles)) {
        if (file) {
          const path = `${clienteId}/${tipo}_${Date.now()}`
          const { error: uploadError } = await sb.storage.from('clientes-docs').upload(path, file, { contentType: file.type })
          if (!uploadError) {
            const { data: urlData } = await sb.storage.from('clientes-docs').createSignedUrl(path, 60*60*24*365)
            await sb.from('cliente_documentos').insert({ cliente_id: clienteId, tipo_doc: tipo, url_archivo: urlData.signedUrl })
          }
        }
      }
      showMsg(`✅ Cliente ${clienteForm.razon_social} creado — pendiente de validación`)
      setShowClienteForm(false)
      setClienteForm(CLIENTE_FORM_INITIAL)
      setDocFiles({csf:null, opinion_32d:null, identificacion:null, acta_constitutiva:null})
      setClienteTab('fiscal')
      await loadAll(sb)
    } catch(e) {
      showMsg('❌ Error: ' + e.message)
    } finally {
      setClienteProcessing(false)
    }
  }

  const cambiarStatusCliente = async (clienteId, nuevoStatus, nota = '') => {
    const sb = createClient()
    const { data: { user: authUser } } = await sb.auth.getUser()
    const { data: userData } = await sb.from('users').select('role, id, full_name').eq('auth_id', authUser.id).single()
    if (!['admin', 'gerente_finanzas'].includes(userData.role)) {
      showMsg('❌ Solo Admin o Gerente de Finanzas pueden cambiar el status del cliente')
      return
    }
    const update = { status: nuevoStatus }
    if (nuevoStatus === 'situacion_especial') {
      update.situacion_especial_nota = nota
      update.situacion_especial_por = userData.id
      update.situacion_especial_fecha = new Date().toISOString()
      update.situacion_especial_rol = userData.role
    }
    await sb.from('clientes').update(update).eq('id', clienteId)
    const labels = { activo:'✅ Cliente activado', bloqueado:'⛔ Cliente bloqueado', inactivo:'Cliente inactivado', situacion_especial:'⚠️ Situación especial registrada' }
    showMsg(labels[nuevoStatus] || 'Status actualizado')
    await loadAll(sb)
  }

  const abrirSitEspecial = (clienteId) => {
    setSitEspecialClienteId(clienteId)
    setSitEspecialNota('')
    setShowSitEspecialModal(true)
    setSelectedCliente(null)
  }

  const confirmarSitEspecial = async () => {
    if (!sitEspecialNota.trim()) { showMsg('❌ Escribe el motivo de la situación especial'); return }
    await cambiarStatusCliente(sitEspecialClienteId, 'situacion_especial', sitEspecialNota)
    setShowSitEspecialModal(false)
    setSitEspecialClienteId(null)
    setSitEspecialNota('')
  }

  const doAssign = async () => {
    if (!assignDriver) { showMsg('Selecciona un repartidor'); return }
    setProcessing(true)
    try {
      const sb = createClient(); const now = new Date().toISOString()
      const { error } = await sb.from('orders').update({ driver_id: assignDriver, status:'assigned', status_updated_at: now }).eq('id', assignOrder.id)
      if (error) throw error
      await sb.from('order_events').insert({ order_id: assignOrder.id, status:'assigned', status_code: assignCode, note:'Asignado por administrador', created_at: now })
      showMsg(`Orden ${assignOrder.tracking_code} asignada`); setAssignOrder(null)
      await loadAll(sb)
    } catch(e){ showMsg('Error: '+e.message) } finally { setProcessing(false) }
  }

  const doStatus = async () => {
    if (!newStatus) return
    setProcessing(true)
    try {
      const sb = createClient(); const now = new Date().toISOString()
      const extra = newStatus==='delivered' ? {delivered_at:now} : {}
      await sb.from('orders').update({status:newStatus, status_updated_at:now, ...extra}).eq('id',statusOrder.id)
      await sb.from('order_events').insert({order_id:statusOrder.id,status:newStatus,status_code:statusCode||null,note:'Actualizado por admin'})
      showMsg(`Orden ${statusOrder.tracking_code}: ${STATUS_LABEL[newStatus]}`); setStatusOrder(null)
      await loadAll(sb)
    } catch(e){ showMsg('Error: '+e.message) } finally { setProcessing(false) }
  }

  const calcQuote = () => {
    const d = parseFloat(quoteDist), w = parseFloat(quoteWeight)
    if (!d||!w) { showMsg('Ingresa distancia y peso'); return }
    const base = 50, perKm = 2.5, perKg = 8
    const subtotal = base + (d * perKm) + (w * perKg)
    const tax = subtotal * 0.16
    setQuoteResult({ subtotal: subtotal.toFixed(2), tax: tax.toFixed(2), total: (subtotal+tax).toFixed(2), standard: subtotal.toFixed(2), express: (subtotal*1.4).toFixed(2), same_day: (subtotal*1.9).toFixed(2) })
  }

  const toggleDriver = async (driverId, currentStatus) => {
    const sb = createClient()
    await sb.from('drivers').update({status: currentStatus==='online'?'offline':'online'}).eq('id',driverId)
    await loadAll(sb)
  }

  const stats = {
    total: orders.length,
    completed: orders.filter(o=>o.status==='delivered').length,
    activeDrivers: drivers.filter(d=>d.status==='online').length,
    revenue: orders.filter(o=>o.status==='delivered').reduce((s,o)=>s+parseFloat(o.total||0),0),
    clientesB2B: clientesB2B.length,
    clientesPendientes: clientesB2B.filter(c=>c.status==='pendiente').length,
    clientesSituacion: clientesB2B.filter(c=>c.status==='situacion_especial').length,
  }

  const filteredOrders = orders.filter(o => {
    const matchSearch = !search || o.tracking_code?.toLowerCase().includes(search.toLowerCase()) || o.client?.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus==='all' || o.status===filterStatus
    return matchSearch && matchStatus
  })

  const last7 = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-6+i)
    const key = d.toISOString().slice(0,10)
    const label = d.toLocaleDateString('es-MX',{weekday:'short'})
    const count = orders.filter(o=>o.created_at?.slice(0,10)===key).length
    return { label, count }
  })
  const maxBar = Math.max(...last7.map(d=>d.count), 1)

  const bg   = dark ? '#111827' : '#F9FAFB'
  const card = dark ? '#1F2937' : '#FFFFFF'
  const text = dark ? '#F9FAFB' : '#111827'
  const sub  = dark ? '#9CA3AF' : '#6B7280'
  const bdr  = dark ? '#374151' : '#E5E7EB'
  const sbg  = dark ? '#111827' : '#FFFFFF'
  const sact = dark ? '#FFFFFF' : '#000000'
  const sinact = dark ? '#6B7280' : '#6B7280'

  const navItems = [
    {id:'dashboard',    label:'Dashboard',     icon:'▦'},
    {id:'orders',       label:'Paquetería',    icon:'📦'},
    {id:'maritimo',     label:'Marítimo',      icon:'🚢'},
    {id:'aereo',        label:'Aéreo',         icon:'✈️'},
    {id:'transporte',   label:'Transporte',    icon:'🚛'},
    {id:'clientes_b2b', label:'Clientes B2B',  icon:'🏢'},
    {id:'quote',        label:'Cotización',    icon:'🧮'},
    {id:'clients',      label:'Usuarios',      icon:'👤'},
    {id:'drivers',      label:'Repartidores',  icon:'🚚'},
    {id:'tracking',     label:'Rastreo',       icon:'🗺'},
    {id:'reports',      label:'Reportes',      icon:'📊'},
  ]

  const CF = (f) => clienteForm[f]
  const setCF = (f,v) => setClienteForm(p=>({...p,[f]:v}))

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0F6E56'}}>
      <div style={{background:'#fff',borderRadius:16,padding:'2rem',textAlign:'center'}}><p style={{color:'#0F6E56',fontWeight:600}}>Cargando...</p></div>
    </div>
  )

  return (
    <div style={{display:'flex',minHeight:'100vh',background:bg,fontFamily:'system-ui,sans-serif',color:text}}>

      {/* SIDEBAR */}
      <div style={{width:220,background:sbg,borderRight:`1px solid ${bdr}`,display:'flex',flexDirection:'column',padding:'1.25rem 0',flexShrink:0}}>
        <div style={{padding:'0 1.25rem 1.5rem',fontWeight:700,fontSize:18,color:sact}}>LogiAdmin</div>
        {navItems.map(n=>(
          <div key={n.id} onClick={()=>setSection(n.id)}
            style={{display:'flex',alignItems:'center',gap:10,padding:'10px 1.25rem',cursor:'pointer',fontSize:14,borderRadius:6,margin:'1px 8px',
              background:section===n.id?(dark?'#374151':'#000'):'transparent',
              color:section===n.id?'#fff':sinact,fontWeight:section===n.id?600:400,position:'relative'}}>
            <span style={{fontSize:16}}>{n.icon}</span>
            {n.label}
            {n.id==='clientes_b2b' && (stats.clientesPendientes + stats.clientesSituacion) > 0 && (
              <span style={{marginLeft:'auto',background:'#EF4444',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:20,fontWeight:700}}>
                {stats.clientesPendientes + stats.clientesSituacion}
              </span>
            )}
          </div>
        ))}
        <div style={{marginTop:'auto',padding:'1rem 1.25rem',borderTop:`1px solid ${bdr}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
            <span style={{fontSize:13,color:sub}}>Tema oscuro</span>
            <button onClick={()=>setDark(!dark)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20}}>🌙</button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'#374151',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700}}>A</div>
            <div><div style={{fontSize:13,fontWeight:600,color:text}}>Admin</div><div style={{fontSize:11,color:sub}}>{user?.email}</div></div>
          </div>
          <button onClick={logout} style={{display:'flex',alignItems:'center',gap:6,marginTop:'0.75rem',background:'none',border:'none',cursor:'pointer',color:'#EF4444',fontSize:13}}>
            ↩ Cerrar Sesión
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,padding:'2rem',overflow:'auto'}}>
        {msg && <div style={{position:'fixed',top:16,right:16,background:'#0F6E56',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:13,zIndex:300}}>{msg}</div>}

        {/* DASHBOARD */}
        {section==='dashboard' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Dashboard</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>Resumen de la plataforma logística.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:'1.5rem'}}>
              {[
                {label:'Órdenes Totales', value:stats.total, icon:'📦'},
                {label:'Envíos Completados', value:stats.completed, icon:'✅'},
                {label:'Repartidores Activos', value:stats.activeDrivers, icon:'🚚'},
                {label:'Clientes B2B', value:stats.clientesB2B, icon:'🏢'},
                {label:'Pendientes Validación', value:stats.clientesPendientes, icon:'⏳'},
                {label:'Situación Especial', value:stats.clientesSituacion, icon:'⚠️'},
              ].map((k,i)=>(
                <div key={i} style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,padding:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{fontSize:13,color:sub}}>{k.label}</span>
                    <span style={{fontSize:18}}>{k.icon}</span>
                  </div>
                  <div style={{fontSize:26,fontWeight:700,color:text}}>{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,padding:'1.25rem'}}>
              <div style={{fontWeight:600,marginBottom:'1rem',fontSize:15}}>Órdenes por Día (Última Semana)</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:10,height:140}}>
                {last7.map((d,i)=>(
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{width:'100%',background:dark?'#374151':'#E5E7EB',borderRadius:'4px 4px 0 0',height:120,display:'flex',alignItems:'flex-end'}}>
                      <div style={{width:'100%',background:dark?'#F9FAFB':'#111827',borderRadius:'4px 4px 0 0',height:`${(d.count/maxBar)*100}%`,minHeight:d.count?4:0,transition:'height .3s'}}/>
                    </div>
                    <span style={{fontSize:11,color:sub}}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PAQUETERÍA */}
        {section==='orders' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.5rem'}}>
              <div><h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Paquetería</h1><p style={{color:sub,fontSize:14}}>Gestiona los envíos de la plataforma.</p></div>
              <button onClick={()=>router.push('/orders/new')} style={{padding:'10px 18px',background:'#111827',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600}}>Nueva Orden</button>
            </div>
            <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,padding:'1rem',marginBottom:'1rem'}}>
              <div style={{display:'flex',gap:10,marginBottom:'1rem',position:'relative'}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por tracking..." style={{flex:1,padding:'8px 12px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,background:bg,color:text}} />
                <div style={{position:'relative'}}>
                  <button onClick={()=>setShowOrderMenu(!showOrderMenu)} style={{padding:'8px 14px',border:`1px solid ${bdr}`,borderRadius:8,background:bg,color:text,cursor:'pointer',fontSize:14}}>
                    {filterStatus==='all'?'Todos los estados':STATUS_LABEL[filterStatus]} ▾
                  </button>
                  {showOrderMenu && (
                    <div style={{position:'absolute',top:'100%',right:0,background:card,border:`1px solid ${bdr}`,borderRadius:8,zIndex:50,minWidth:180,boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
                      {['all','pending','in_transit','delivered','cancelled'].map(s=>(
                        <div key={s} onClick={()=>{setFilterStatus(s);setShowOrderMenu(false)}}
                          style={{padding:'9px 14px',cursor:'pointer',fontSize:14,color:text}}>
                          {s==='all'?'Todos los estados':STATUS_LABEL[s]}{filterStatus===s&&' ✓'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${bdr}`}}>
                    {['Tracking','Cliente','Repartidor','Destino','Precio','Estado','Acciones'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'8px 6px',color:sub,fontWeight:500,fontSize:12}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length===0 && <tr><td colSpan={7} style={{padding:'2rem',textAlign:'center',color:sub}}>No hay órdenes</td></tr>}
                  {filteredOrders.map(o=>(
                    <tr key={o.id} style={{borderBottom:`1px solid ${bdr}`}}>
                      <td style={{padding:'10px 6px',fontWeight:600,fontSize:12}}>{o.tracking_code}</td>
                      <td style={{padding:'10px 6px',color:sub,fontSize:12}}>{o.client?.full_name||o.client?.email||'—'}</td>
                      <td style={{padding:'10px 6px',color:sub,fontSize:12}}>{o.driver?.user?.full_name||'Sin asignar'}</td>
                      <td style={{padding:'10px 6px',color:sub,fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.dest_address}</td>
                      <td style={{padding:'10px 6px',fontWeight:600,fontSize:12}}>{fmtMoney(o.total)}</td>
                      <td style={{padding:'10px 6px'}}>
                        <span style={{background:STATUS_COLOR[o.status],color:STATUS_TEXT[o.status],fontSize:11,padding:'3px 8px',borderRadius:20,fontWeight:600}}>{STATUS_LABEL[o.status]}</span>
                      </td>
                      <td style={{padding:'10px 6px'}}>
                        <div style={{display:'flex',gap:4}}>
                          {o.status==='pending'&&<button onClick={()=>{setAssignOrder(o);setAssignDriver('')}} style={{padding:'4px 8px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>Asignar</button>}
                          <button onClick={()=>{setStatusOrder(o);setNewStatus(o.status);setStatusCode('')}} style={{padding:'4px 8px',background:'#185FA5',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>Estado</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MARÍTIMO */}
        {section==='maritimo' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Transporte Marítimo</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>FCL y LCL — próximamente disponible.</p>
            <div style={{textAlign:'center',padding:'4rem 2rem',background:card,borderRadius:12,border:`1px solid ${bdr}`}}>
              <div style={{fontSize:64,marginBottom:16}}>🚢</div>
              <p style={{color:sub,fontSize:15,fontWeight:500}}>Módulo en desarrollo.</p>
              <p style={{color:sub,fontSize:13,marginTop:4}}>Disponible en R2.</p>
            </div>
          </div>
        )}

        {/* AÉREO */}
        {section==='aereo' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Transporte Aéreo</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>Envíos express nacionales e internacionales — próximamente.</p>
            <div style={{textAlign:'center',padding:'4rem 2rem',background:card,borderRadius:12,border:`1px solid ${bdr}`}}>
              <div style={{fontSize:64,marginBottom:16}}>✈️</div>
              <p style={{color:sub,fontSize:15,fontWeight:500}}>Módulo en desarrollo.</p>
              <p style={{color:sub,fontSize:13,marginTop:4}}>Disponible en R2.</p>
            </div>
          </div>
        )}

        {/* TRANSPORTE */}
        {section==='transporte' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Transporte Terrestre FTL</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>Gestión de solicitudes de transporte.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:'1.5rem'}}>
              {[
                {label:'Total solicitudes', value:transportOrders.length, icon:'🚛'},
                {label:'Pendientes',        value:transportOrders.filter(o=>o.status==='pending').length, icon:'⏳'},
                {label:'En tránsito',       value:transportOrders.filter(o=>o.status==='in_transit').length, icon:'🛣️'},
                {label:'Completadas',       value:transportOrders.filter(o=>o.status==='delivered').length, icon:'✅'},
              ].map((k,i)=>(
                <div key={i} style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,padding:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{fontSize:13,color:sub}}>{k.label}</span>
                    <span style={{fontSize:18}}>{k.icon}</span>
                  </div>
                  <div style={{fontSize:26,fontWeight:700,color:text}}>{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${bdr}`}}>
                    {['Tracking','Cliente','Ruta','Unidad','Fecha requerida','Total','Status','Acciones'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'12px 16px',color:sub,fontWeight:500,fontSize:12}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transportOrders.length===0 && (
                    <tr><td colSpan={8} style={{padding:'3rem',textAlign:'center',color:sub}}>No hay solicitudes de transporte.</td></tr>
                  )}
                  {transportOrders.map(o=>(
                    <tr key={o.id} style={{borderBottom:`1px solid ${bdr}`}}>
                      <td style={{padding:'12px 16px',fontWeight:600,fontSize:12}}>{o.tracking_code}</td>
                      <td style={{padding:'12px 16px',color:sub,fontSize:12}}>{o.client?.full_name||o.client?.email||'—'}</td>
                      <td style={{padding:'12px 16px',fontSize:12}}>{o.ruta}</td>
                      <td style={{padding:'12px 16px',fontSize:12}}>{o.unit?.nombre}</td>
                      <td style={{padding:'12px 16px',color:sub,fontSize:12}}>{o.fecha_requerida ? new Date(o.fecha_requerida).toLocaleDateString('es-MX') : '—'}</td>
                      <td style={{padding:'12px 16px',fontWeight:600,fontSize:12}}>{fmtMoney(o.total)}</td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{
                          fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:600,
                          background:{pending:'#FAEEDA',confirmed:'#E1F5EE',in_transit:'#EFF6FF',delivered:'#DCFCE7',cancelled:'#FEE2E2'}[o.status]||'#F3F4F6',
                          color:{pending:'#92400E',confirmed:'#065F46',in_transit:'#1E40AF',delivered:'#166534',cancelled:'#991B1B'}[o.status]||'#6B7280',
                        }}>
                          {{pending:'Pendiente',confirmed:'Confirmado',in_transit:'En tránsito',delivered:'Entregado',cancelled:'Cancelado'}[o.status]||o.status}
                        </span>
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',gap:4}}>
                          <button onClick={()=>setSelectedTransport(o)}
                            style={{padding:'4px 8px',background:'#185FA5',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>
                            Ver
                          </button>
                          <button onClick={()=>{setTransportStatusOrder(o);setNewTransportStatus(o.status);setAssignTransportDriver(o.driver_id||'')}}
                            style={{padding:'4px 8px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>
                            Gestionar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CLIENTES B2B */}
        {section==='clientes_b2b' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.5rem'}}>
              <div>
                <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Clientes B2B</h1>
                <p style={{color:sub,fontSize:14}}>Gestión de clientes empresariales.</p>
              </div>
              <button onClick={()=>{setShowClienteForm(true);setClienteTab('fiscal')}}
                style={{padding:'10px 18px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600}}>
                + Nuevo Cliente
              </button>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:'1rem',flexWrap:'wrap'}}>
              {Object.entries(STATUS_CLIENTE_LABEL).map(([key, label]) => {
                const count = clientesB2B.filter(c=>c.status===key).length
                return (
                  <div key={key} style={{
                    padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'default',
                    background: STATUS_CLIENTE_COLOR[key]?.bg,
                    color: STATUS_CLIENTE_COLOR[key]?.text,
                    border: `1px solid ${STATUS_CLIENTE_COLOR[key]?.text}40`
                  }}>
                    {label} ({count})
                  </div>
                )
              })}
            </div>
            <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${bdr}`}}>
                    {['Razón Social','RFC','Servicios','Crédito','Contacto','Status','Acciones'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'12px 16px',color:sub,fontWeight:500,fontSize:12}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientesB2B.length===0 && (
                    <tr><td colSpan={7} style={{padding:'3rem',textAlign:'center',color:sub}}>
                      No hay clientes B2B registrados. Crea el primero con "+ Nuevo Cliente".
                    </td></tr>
                  )}
                  {clientesB2B.map(c=>(
                    <tr key={c.id} style={{borderBottom:`1px solid ${bdr}`}}>
                      <td style={{padding:'12px 16px',fontWeight:600,fontSize:13}}>{c.razon_social}</td>
                      <td style={{padding:'12px 16px',color:sub,fontSize:12,fontFamily:'monospace'}}>{c.rfc}</td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{background:'#EFF6FF',color:'#1E40AF',fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:500}}>
                          {c.servicios==='ambos'?'Paquetería + Transporte':c.servicios==='paqueteria'?'Paquetería':'Transporte'}
                        </span>
                      </td>
                      <td style={{padding:'12px 16px',color:sub,fontSize:12}}>{fmtMoney(c.limite_credito)} / {c.dias_credito} días</td>
                      <td style={{padding:'12px 16px',color:sub,fontSize:12}}>
                        {c.contactos?.[0]?.nombre || '—'}
                        {c.contactos?.[0]?.email && <div style={{fontSize:11,color:sub}}>{c.contactos[0].email}</div>}
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{
                          background: STATUS_CLIENTE_COLOR[c.status]?.bg || '#F3F4F6',
                          color: STATUS_CLIENTE_COLOR[c.status]?.text || '#6B7280',
                          fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:600
                        }}>{STATUS_CLIENTE_LABEL[c.status] || c.status}</span>
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {c.status==='pendiente' && (
                            <button onClick={()=>cambiarStatusCliente(c.id,'activo')}
                              style={{padding:'4px 8px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>
                              Aprobar
                            </button>
                          )}
                          {c.status==='activo' && (
                            <button onClick={()=>abrirSitEspecial(c.id)}
                              style={{padding:'4px 8px',background:'#EA580C',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>
                              ⚠️ Sit. Especial
                            </button>
                          )}
                          {(c.status==='activo'||c.status==='situacion_especial') && (
                            <button onClick={()=>cambiarStatusCliente(c.id,'bloqueado')}
                              style={{padding:'4px 8px',background:'#EF4444',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>
                              Bloquear
                            </button>
                          )}
                          {(c.status==='bloqueado'||c.status==='situacion_especial') && (
                            <button onClick={()=>cambiarStatusCliente(c.id,'activo')}
                              style={{padding:'4px 8px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>
                              Reactivar
                            </button>
                          )}
                          <button onClick={()=>setSelectedCliente(c)}
                            style={{padding:'4px 8px',background:'#185FA5',color:'#fff',border:'none',borderRadius:5,cursor:'pointer',fontSize:11}}>
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COTIZACIÓN */}
        {section==='quote' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Cotización</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>Calculadora de tarifas en tiempo real.</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,padding:'1.5rem'}}>
                <div style={{fontWeight:600,marginBottom:'1rem'}}>Calculadora de Envíos</div>
                <div style={{marginBottom:'1rem'}}>
                  <label style={{fontSize:13,color:sub,display:'block',marginBottom:6}}>Distancia estimada (km)</label>
                  <input value={quoteDist} onChange={e=>setQuoteDist(e.target.value)} type="number" placeholder="Ej. 15.5"
                    style={{width:'100%',padding:'9px 12px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,background:bg,color:text,boxSizing:'border-box'}} />
                </div>
                <div style={{marginBottom:'1.5rem'}}>
                  <label style={{fontSize:13,color:sub,display:'block',marginBottom:6}}>Peso del paquete (kg)</label>
                  <input value={quoteWeight} onChange={e=>setQuoteWeight(e.target.value)} type="number" placeholder="Ej. 2.5"
                    style={{width:'100%',padding:'9px 12px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,background:bg,color:text,boxSizing:'border-box'}} />
                </div>
                <button onClick={calcQuote} style={{width:'100%',padding:'11px',background:dark?'#F9FAFB':'#111827',color:dark?'#111827':'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600}}>
                  🧮 Calcular Tarifa
                </button>
              </div>
              <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,padding:'1.5rem'}}>
                {!quoteResult ? (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:sub,gap:12}}>
                    <span style={{fontSize:40}}>🧮</span>
                    <p style={{fontSize:13,textAlign:'center'}}>Ingresa la distancia y el peso para ver la tarifa.</p>
                  </div>
                ) : (
                  <div>
                    <div style={{fontWeight:600,marginBottom:'1rem'}}>Resultado de Cotización</div>
                    {[
                      {label:'Estándar (3-5 días)', value:quoteResult.standard, color:'#0F6E56'},
                      {label:'Express (1-2 días)', value:quoteResult.express, color:'#185FA5'},
                      {label:'Mismo día', value:quoteResult.same_day, color:'#7C3AED'},
                    ].map((r,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${bdr}`}}>
                        <span style={{fontSize:13,color:sub}}>{r.label}</span>
                        <span style={{fontWeight:700,color:r.color,fontSize:15}}>{fmtMoney(r.value)}</span>
                      </div>
                    ))}
                    <div style={{marginTop:'1rem',padding:'10px',background:dark?'#374151':'#F9FAFB',borderRadius:8,fontSize:12,color:sub}}>
                      Subtotal: {fmtMoney(quoteResult.subtotal)} · IVA (16%): {fmtMoney(quoteResult.tax)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* USUARIOS */}
        {section==='clients' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Usuarios</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>Usuarios registrados en la plataforma.</p>
            <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${bdr}`}}>
                    {['Nombre','Email','Teléfono','Estado','Acciones'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'12px 16px',color:sub,fontWeight:500,fontSize:12}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.length===0&&<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:sub}}>No hay usuarios registrados</td></tr>}
                  {clients.map(c=>(
                    <tr key={c.id} style={{borderBottom:`1px solid ${bdr}`}}>
                      <td style={{padding:'12px 16px',fontWeight:600}}>{c.full_name||'Sin nombre'}</td>
                      <td style={{padding:'12px 16px',color:sub}}>{c.email}</td>
                      <td style={{padding:'12px 16px',color:sub}}>{c.phone||'N/A'}</td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{background:'#DCFCE7',color:'#166534',fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:600}}>Activo</span>
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        <button style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444',fontSize:16}}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPARTIDORES */}
        {section==='drivers' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Repartidores</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>Gestiona la flota de repartidores.</p>
            <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${bdr}`}}>
                    {['Nombre','Email','Teléfono','Estado Activo','Acciones'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'12px 16px',color:sub,fontWeight:500,fontSize:12}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.length===0&&<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:sub}}>No hay repartidores registrados</td></tr>}
                  {drivers.map(d=>(
                    <tr key={d.id} style={{borderBottom:`1px solid ${bdr}`}}>
                      <td style={{padding:'12px 16px',fontWeight:600}}>{d.user?.full_name||'Sin nombre'}</td>
                      <td style={{padding:'12px 16px',color:sub}}>{d.user?.email||'—'}</td>
                      <td style={{padding:'12px 16px',color:sub}}>{d.user?.phone||'N/A'}</td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div onClick={()=>toggleDriver(d.id,d.status)}
                            style={{width:42,height:24,borderRadius:12,background:d.status==='online'?'#111827':'#D1D5DB',cursor:'pointer',position:'relative',transition:'background .2s'}}>
                            <div style={{position:'absolute',top:2,left:d.status==='online'?18:2,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left .2s'}}/>
                          </div>
                          <span style={{fontSize:13,color:d.status==='online'?text:sub}}>{d.status==='online'?'Activo':'Inactivo'}</span>
                        </div>
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        <button style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444',fontSize:16}}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RASTREO */}
        {section==='tracking' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Rastreo en Tiempo Real</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>Ubicación actual de los repartidores activos.</p>
            <div style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,overflow:'hidden',height:480}}>
              <TrackingMap drivers={drivers} dark={dark} />
            </div>
          </div>
        )}

        {/* REPORTES */}
        {section==='reports' && (
          <div>
            <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Reportes y Analíticas</h1>
            <p style={{color:sub,marginBottom:'1.5rem',fontSize:14}}>Métricas de desempeño de la plataforma.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
              {[
                {label:'Total órdenes', value:stats.total},
                {label:'Tasa de entrega', value:stats.total>0?`${Math.round((stats.completed/stats.total)*100)}%`:'0%'},
                {label:'Ingresos totales', value:fmtMoney(stats.revenue)},
              ].map((k,i)=>(
                <div key={i} style={{background:card,border:`1px solid ${bdr}`,borderRadius:10,padding:'1rem',textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:700,color:text,marginBottom:4}}>{k.value}</div>
                  <div style={{fontSize:12,color:sub}}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL VER TRANSPORTE */}
        {selectedTransport && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
            <div style={{background:card,borderRadius:16,width:'100%',maxWidth:580,maxHeight:'85vh',overflowY:'auto',padding:'1.5rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                <h3 style={{fontWeight:700,fontSize:16,color:text}}>🚛 {selectedTransport.tracking_code}</h3>
                <button onClick={()=>setSelectedTransport(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:sub}}>✕</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:'1.5rem'}}>
                {[
                  {label:'Cliente',        value:selectedTransport.client?.full_name||selectedTransport.client?.email||'—'},
                  {label:'Ruta',           value:selectedTransport.ruta},
                  {label:'Unidad',         value:selectedTransport.unit?.nombre},
                  {label:'Peso (kg)',      value:selectedTransport.peso_kg||'—'},
                  {label:'Volumen (m³)',   value:selectedTransport.volumen_m3||'—'},
                  {label:'Fecha requerida',value:selectedTransport.fecha_requerida ? new Date(selectedTransport.fecha_requerida).toLocaleDateString('es-MX') : '—'},
                  {label:'Subtotal',       value:fmtMoney(selectedTransport.subtotal)},
                  {label:'IVA',            value:fmtMoney(selectedTransport.iva)},
                  {label:'Retención',      value:fmtMoney(selectedTransport.retencion)},
                  {label:'Total',          value:fmtMoney(selectedTransport.total)},
                ].map((f,i)=>(
                  <div key={i} style={{background:bg,borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:11,color:sub,marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:text}}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:8,fontSize:12,color:sub}}>
                {selectedTransport.incluye_maniobra && '✓ Maniobra  '}
                {selectedTransport.incluye_reparto && '✓ Reparto  '}
                {selectedTransport.incluye_flete_falso && '✓ Flete en falso  '}
              </div>
              {selectedTransport.notas && (
                <div style={{background:bg,borderRadius:8,padding:'10px 12px',marginBottom:'1rem',fontSize:13,color:sub,fontStyle:'italic'}}>
                  📝 {selectedTransport.notas}
                </div>
              )}
              {selectedTransport.stops?.length > 0 && (
                <div style={{marginBottom:'1rem'}}>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>📍 Paradas</div>
                  {[...selectedTransport.stops].sort((a,b)=>a.orden-b.orden).map((stop,i)=>(
                    <div key={i} style={{
                      background:stop.tipo==='carga'?'#F0FDF4':'#EFF6FF',
                      border:`1px solid ${stop.tipo==='carga'?'#9FE1CB':'#BFDBFE'}`,
                      borderRadius:8,padding:'10px 12px',marginBottom:6,fontSize:12
                    }}>
                      <div style={{fontWeight:600,color:stop.tipo==='carga'?'#0F6E56':'#185FA5',marginBottom:4}}>
                        {stop.orden}. {stop.tipo==='carga'?'📦 CARGA':'📍 DESCARGA'} — {stop.alias||''}
                      </div>
                      <div style={{color:sub}}>{stop.calle||'Sin dirección'}</div>
                      {stop.instrucciones && <div style={{color:sub,fontStyle:'italic',marginTop:2}}>{stop.instrucciones}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button onClick={()=>{setTransportStatusOrder(selectedTransport);setNewTransportStatus(selectedTransport.status);setAssignTransportDriver(selectedTransport.driver_id||'');setSelectedTransport(null)}}
                  style={{padding:'8px 16px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>
                  Gestionar
                </button>
                <button onClick={()=>setSelectedTransport(null)}
                  style={{padding:'8px 16px',border:`1px solid ${bdr}`,borderRadius:8,background:'none',cursor:'pointer',fontSize:13,color:text}}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL GESTIONAR TRANSPORTE */}
        {transportStatusOrder && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
            <div style={{background:card,borderRadius:16,width:'100%',maxWidth:460,padding:'1.5rem',border:`1px solid ${bdr}`}}>
              <h3 style={{fontWeight:700,fontSize:16,color:text,marginBottom:'1.25rem'}}>
                🚛 Gestionar — {transportStatusOrder.tracking_code}
              </h3>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Status</label>
                  <select value={newTransportStatus} onChange={e=>setNewTransportStatus(e.target.value)}
                    style={{width:'100%',padding:'9px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,background:bg,color:text}}>
                    {[
                      {v:'pending',   l:'Pendiente'},
                      {v:'confirmed', l:'Confirmado'},
                      {v:'in_transit',l:'En tránsito'},
                      {v:'delivered', l:'Entregado'},
                      {v:'cancelled', l:'Cancelado'},
                    ].map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Asignar chofer</label>
                  <select value={assignTransportDriver} onChange={e=>setAssignTransportDriver(e.target.value)}
                    style={{width:'100%',padding:'9px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,background:bg,color:text}}>
                    <option value=''>— Sin asignar —</option>
                    {drivers.map(d=>(
                      <option key={d.id} value={d.id}>{d.user?.full_name||d.user?.email}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:'1.5rem'}}>
                <button onClick={()=>setTransportStatusOrder(null)}
                  style={{padding:'8px 16px',border:`1px solid ${bdr}`,borderRadius:8,background:'none',cursor:'pointer',fontSize:13,color:text}}>
                  Cancelar
                </button>
                <button disabled={transportProcessing} onClick={async()=>{
                  setTransportProcessing(true)
                  try {
                    const sb = createClient()
                    await sb.from('transport_orders').update({
                      status: newTransportStatus,
                      driver_id: assignTransportDriver || null,
                      status_updated_at: new Date().toISOString()
                    }).eq('id', transportStatusOrder.id)
                    setTransportStatusOrder(null)
                    await loadAll(sb)
                  } catch(e){ console.error(e) }
                  finally { setTransportProcessing(false) }
                }}
                  style={{padding:'8px 18px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,opacity:transportProcessing?0.6:1}}>
                  {transportProcessing?'Guardando...':'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ASIGNAR */}
        {assignOrder && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
            <div style={{background:card,borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:420,margin:'1rem',border:`1px solid ${bdr}`}}>
              <h3 style={{fontWeight:600,marginBottom:6,color:text}}>Asignar #{assignOrder.tracking_code}</h3>
              <p style={{fontSize:13,color:sub,marginBottom:'1rem'}}>{assignOrder.dest_address}</p>
              <div style={{marginBottom:'1rem'}}>
                <label style={{fontSize:13,color:sub,display:'block',marginBottom:5}}>Repartidor</label>
                <select value={assignDriver} onChange={e=>setAssignDriver(e.target.value)} style={{width:'100%',padding:'9px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,background:bg,color:text}}>
                  <option value=''>-- Seleccionar --</option>
                  {drivers.map(d=><option key={d.id} value={d.id}>{d.user?.full_name||d.user?.email}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button onClick={()=>setAssignOrder(null)} style={{padding:'8px 16px',border:`1px solid ${bdr}`,borderRadius:8,background:'none',cursor:'pointer',color:text,fontSize:13}}>Cancelar</button>
                <button onClick={doAssign} disabled={processing} style={{padding:'8px 18px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,opacity:processing?0.6:1}}>
                  {processing?'Asignando...':'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL STATUS */}
        {statusOrder && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
            <div style={{background:card,borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:420,margin:'1rem',border:`1px solid ${bdr}`}}>
              <h3 style={{fontWeight:600,marginBottom:6,color:text}}>Cambiar estado #{statusOrder.tracking_code}</h3>
              <div style={{marginBottom:'1rem'}}>
                <label style={{fontSize:13,color:sub,display:'block',marginBottom:5}}>Nuevo estado</label>
                <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{width:'100%',padding:'9px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,background:bg,color:text}}>
                  {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button onClick={()=>setStatusOrder(null)} style={{padding:'8px 16px',border:`1px solid ${bdr}`,borderRadius:8,background:'none',cursor:'pointer',color:text,fontSize:13}}>Cancelar</button>
                <button onClick={doStatus} disabled={processing} style={{padding:'8px 18px',background:'#185FA5',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,opacity:processing?0.6:1}}>
                  {processing?'Actualizando...':'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL NUEVO CLIENTE B2B */}
        {showClienteForm && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
            <div style={{background:card,borderRadius:16,width:'100%',maxWidth:640,maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <div style={{padding:'1.25rem 1.5rem',borderBottom:`1px solid ${bdr}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{fontWeight:700,fontSize:16,color:text}}>🏢 Nuevo Cliente B2B</h3>
                <button onClick={()=>setShowClienteForm(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:sub}}>✕</button>
              </div>
              <div style={{display:'flex',borderBottom:`1px solid ${bdr}`,padding:'0 1.5rem'}}>
                {[{id:'fiscal',label:'Fiscal'},{id:'comercial',label:'Comercial'},{id:'contacto',label:'Contacto'},{id:'documentos',label:'Documentos'}].map(t=>(
                  <button key={t.id} onClick={()=>setClienteTab(t.id)}
                    style={{padding:'10px 16px',border:'none',background:'none',cursor:'pointer',fontSize:13,
                      color:clienteTab===t.id?'#0F6E56':sub,fontWeight:clienteTab===t.id?600:400,
                      borderBottom:clienteTab===t.id?'2px solid #0F6E56':'2px solid transparent',marginBottom:-1}}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'1.5rem'}}>
                {clienteTab==='fiscal' && (
                  <div style={{display:'flex',flexDirection:'column',gap:14}}>
                    <div>
                      <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Razón Social *</label>
                      <input value={CF('razon_social')} onChange={e=>setCF('razon_social',e.target.value)} placeholder="EMPRESA SA DE CV"
                        style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                    </div>
                    <div>
                      <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>RFC *</label>
                      <input value={CF('rfc')} onChange={e=>handleRFCChange(e.target.value)} placeholder="EMP123456A78"
                        style={{width:'100%',padding:'9px 11px',border:`1px solid ${rfcError?'#EF4444':bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box',fontFamily:'monospace'}} />
                      {rfcError && <p style={{fontSize:11,color:'#EF4444',marginTop:4}}>{rfcError}</p>}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div>
                        <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Régimen Fiscal *</label>
                        <select value={CF('regimen_fiscal')} onChange={e=>setCF('regimen_fiscal',e.target.value)}
                          style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:12,color:text,background:bg}}>
                          {REGIMENES.map(r=><option key={r.id} value={r.id}>[{r.id}] {r.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>CP Fiscal *</label>
                        <input value={CF('cp_fiscal')} onChange={e=>setCF('cp_fiscal',e.target.value)} placeholder="06600" maxLength={5}
                          style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Uso CFDI</label>
                      <select value={CF('uso_cfdi')} onChange={e=>setCF('uso_cfdi',e.target.value)}
                        style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:13,color:text,background:bg}}>
                        {USOS_CFDI.map(u=><option key={u.id} value={u.id}>[{u.id}] {u.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Servicios contratados</label>
                      <select value={CF('servicios')} onChange={e=>setCF('servicios',e.target.value)}
                        style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:13,color:text,background:bg}}>
                        <option value='ambos'>Paquetería + Transporte</option>
                        <option value='paqueteria'>Solo Paquetería</option>
                        <option value='transporte'>Solo Transporte</option>
                      </select>
                    </div>
                  </div>
                )}
                {clienteTab==='comercial' && (
                  <div style={{display:'flex',flexDirection:'column',gap:14}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div>
                        <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Días de crédito</label>
                        <input type="number" value={CF('dias_credito')} onChange={e=>setCF('dias_credito',e.target.value)}
                          style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                      </div>
                      <div>
                        <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Límite de crédito (MXN)</label>
                        <input type="number" value={CF('limite_credito')} onChange={e=>setCF('limite_credito',e.target.value)}
                          style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                      </div>
                    </div>
                    <div>
                      <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Método de pago</label>
                      <select value={CF('metodo_pago')} onChange={e=>setCF('metodo_pago',e.target.value)}
                        style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:13,color:text,background:bg}}>
                        {METODOS_PAGO.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Forma de pago</label>
                      <select value={CF('forma_pago')} onChange={e=>setCF('forma_pago',e.target.value)}
                        style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:13,color:text,background:bg}}>
                        {FORMAS_PAGO.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </div>
                    <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'12px'}}>
                      <p style={{fontSize:12,color:'#166534',margin:0}}>💡 Catálogos basados en el SAT para CFDI 4.0</p>
                    </div>
                  </div>
                )}
                {clienteTab==='contacto' && (
                  <div style={{display:'flex',flexDirection:'column',gap:14}}>
                    <div style={{fontWeight:600,fontSize:13,color:text,marginBottom:4}}>📍 Dirección Principal</div>
                    <div>
                      <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Alias</label>
                      <input value={CF('dir_alias')} onChange={e=>setCF('dir_alias',e.target.value)} placeholder="Bodega Principal"
                        style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10}}>
                      <div>
                        <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Calle</label>
                        <input value={CF('dir_calle')} onChange={e=>setCF('dir_calle',e.target.value)}
                          style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                      </div>
                      <div>
                        <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Num Ext</label>
                        <input value={CF('dir_num_ext')} onChange={e=>setCF('dir_num_ext',e.target.value)}
                          style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                      </div>
                      <div>
                        <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Num Int</label>
                        <input value={CF('dir_num_int')} onChange={e=>setCF('dir_num_int',e.target.value)}
                          style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
                      {[['dir_colonia','Colonia'],['dir_cp','CP'],['dir_municipio','Municipio'],['dir_estado','Estado']].map(([f,l])=>(
                        <div key={f}>
                          <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>{l}</label>
                          <input value={CF(f)} onChange={e=>setCF(f,e.target.value)} maxLength={f==='dir_cp'?5:undefined}
                            style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:12,color:text,background:bg,boxSizing:'border-box'}} />
                        </div>
                      ))}
                    </div>
                    <div style={{fontWeight:600,fontSize:13,color:text,marginTop:8,marginBottom:4}}>👤 Contacto Principal</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      {[['con_nombre','Nombre'],['con_puesto','Puesto'],['con_email','Email'],['con_telefono','Teléfono']].map(([f,l])=>(
                        <div key={f}>
                          <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>{l}</label>
                          <input type={f==='con_email'?'email':'text'} value={CF(f)} onChange={e=>setCF(f,e.target.value)}
                            placeholder={f==='con_telefono'?'5512345678':f==='con_puesto'?'Tráfico, Compras...':''}
                            style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:14,color:text,background:bg,boxSizing:'border-box'}} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {clienteTab==='documentos' && (
                  <div style={{display:'flex',flexDirection:'column',gap:16}}>
                    <p style={{fontSize:13,color:sub,margin:0}}>Sube los documentos del expediente digital. Todos son opcionales al crear, pero requeridos para activar el cliente.</p>
                    {[
                      {key:'csf', label:'Constancia de Situación Fiscal (CSF)', icon:'📄'},
                      {key:'opinion_32d', label:'Opinión de Cumplimiento 32-D', icon:'✅'},
                      {key:'identificacion', label:'Identificación Oficial del Representante', icon:'🪪'},
                      {key:'acta_constitutiva', label:'Acta Constitutiva', icon:'📋'},
                    ].map(doc=>(
                      <div key={doc.key} style={{border:`1px solid ${bdr}`,borderRadius:8,padding:'12px 16px'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:20}}>{doc.icon}</span>
                            <div>
                              <div style={{fontSize:13,fontWeight:500,color:text}}>{doc.label}</div>
                              {docFiles[doc.key] && <div style={{fontSize:11,color:'#0F6E56',marginTop:2}}>✓ {docFiles[doc.key].name}</div>}
                            </div>
                          </div>
                          <label style={{padding:'6px 12px',background:'#0F6E56',color:'#fff',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>
                            {docFiles[doc.key]?'Cambiar':'Subir'}
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
                              onChange={e=>setDocFiles(p=>({...p,[doc.key]:e.target.files[0]}))} />
                          </label>
                        </div>
                      </div>
                    ))}
                    <div style={{background:'#FAEEDA',border:'1px solid #FCD34D',borderRadius:8,padding:'12px'}}>
                      <p style={{fontSize:12,color:'#92400E',margin:0}}>⚠️ Los archivos se guardan en almacenamiento privado. Solo el administrador puede acceder a ellos.</p>
                    </div>
                  </div>
                )}
              </div>
              <div style={{padding:'1rem 1.5rem',borderTop:`1px solid ${bdr}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',gap:8}}>
                  {clienteTab!=='fiscal' && (
                    <button onClick={()=>setClienteTab(clienteTab==='comercial'?'fiscal':clienteTab==='contacto'?'comercial':'contacto')}
                      style={{padding:'8px 16px',border:`1px solid ${bdr}`,borderRadius:8,background:'none',cursor:'pointer',fontSize:13,color:text}}>
                      ← Anterior
                    </button>
                  )}
                  {clienteTab!=='documentos' && (
                    <button onClick={()=>setClienteTab(clienteTab==='fiscal'?'comercial':clienteTab==='comercial'?'contacto':'documentos')}
                      style={{padding:'8px 16px',border:`1px solid #0F6E56`,borderRadius:8,background:'none',cursor:'pointer',fontSize:13,color:'#0F6E56',fontWeight:600}}>
                      Siguiente →
                    </button>
                  )}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setShowClienteForm(false)}
                    style={{padding:'8px 16px',border:`1px solid ${bdr}`,borderRadius:8,background:'none',cursor:'pointer',fontSize:13,color:text}}>
                    Cancelar
                  </button>
                  <button onClick={crearCliente} disabled={clienteProcessing}
                    style={{padding:'8px 20px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,opacity:clienteProcessing?0.6:1}}>
                    {clienteProcessing?'Guardando...':'✅ Crear Cliente'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL VER CLIENTE */}
        {selectedCliente && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
            <div style={{background:card,borderRadius:16,width:'100%',maxWidth:560,maxHeight:'85vh',overflowY:'auto',padding:'1.5rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                <h3 style={{fontWeight:700,fontSize:16,color:text}}>🏢 {selectedCliente.razon_social}</h3>
                <button onClick={()=>setSelectedCliente(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:sub}}>✕</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:'1.5rem'}}>
                {[
                  {label:'RFC', value:selectedCliente.rfc},
                  {label:'Status', value:STATUS_CLIENTE_LABEL[selectedCliente.status]||selectedCliente.status},
                  {label:'Régimen Fiscal', value:selectedCliente.regimen_fiscal},
                  {label:'CP Fiscal', value:selectedCliente.cp_fiscal},
                  {label:'Días Crédito', value:`${selectedCliente.dias_credito} días`},
                  {label:'Límite Crédito', value:fmtMoney(selectedCliente.limite_credito)},
                  {label:'Método Pago', value:selectedCliente.metodo_pago},
                  {label:'Servicios', value:selectedCliente.servicios},
                ].map((f,i)=>(
                  <div key={i} style={{background:bg,borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:11,color:sub,marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:text}}>{f.value}</div>
                  </div>
                ))}
              </div>
              {selectedCliente.situacion_especial_nota && (
                <div style={{marginBottom:'1.5rem',background:'#FFF0E0',border:'1px solid #EA580C',borderRadius:8,padding:'12px 16px'}}>
                  <div style={{fontWeight:600,fontSize:13,color:'#C2410C',marginBottom:8}}>⚠️ Situación Especial</div>
                  <div style={{fontSize:13,color:'#92400E',marginBottom:6}}><b>Motivo:</b> {selectedCliente.situacion_especial_nota}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div style={{fontSize:12,color:'#92400E'}}><b>Registrado por:</b><br/>{selectedCliente.responsable?.full_name || selectedCliente.responsable?.email || '—'}</div>
                    <div style={{fontSize:12,color:'#92400E'}}><b>Rol:</b><br/>{ROLES_LABEL[selectedCliente.situacion_especial_rol] || selectedCliente.situacion_especial_rol || '—'}</div>
                    <div style={{fontSize:12,color:'#92400E'}}><b>Fecha:</b><br/>{fmtDate(selectedCliente.situacion_especial_fecha)}</div>
                  </div>
                </div>
              )}
              {selectedCliente.contactos?.length > 0 && (
                <div style={{marginBottom:'1.5rem'}}>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>👤 Contactos</div>
                  {selectedCliente.contactos.map((c,i)=>(
                    <div key={i} style={{background:bg,borderRadius:8,padding:'10px 12px',marginBottom:6,fontSize:13}}>
                      <span style={{fontWeight:600}}>{c.nombre}</span>
                      {c.puesto&&<span style={{color:sub}}> · {c.puesto}</span>}
                      {c.email&&<div style={{color:sub,fontSize:12}}>{c.email}</div>}
                    </div>
                  ))}
                </div>
              )}
              {selectedCliente.documentos?.length > 0 && (
                <div style={{marginBottom:'1.5rem'}}>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>📁 Documentos</div>
                  {selectedCliente.documentos.map((d,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:bg,borderRadius:8,padding:'10px 12px',marginBottom:6}}>
                      <span style={{fontSize:13,color:text}}>{d.tipo_doc}</span>
                      <span style={{fontSize:11,color:d.validado?'#166534':'#92400E',background:d.validado?'#DCFCE7':'#FAEEDA',padding:'2px 8px',borderRadius:20}}>
                        {d.validado?'✓ Validado':'Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
                {selectedCliente.status==='pendiente' && (
                  <button onClick={()=>{cambiarStatusCliente(selectedCliente.id,'activo');setSelectedCliente(null)}}
                    style={{padding:'8px 16px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>✅ Aprobar</button>
                )}
                {selectedCliente.status==='activo' && (
                  <button onClick={()=>abrirSitEspecial(selectedCliente.id)}
                    style={{padding:'8px 16px',background:'#EA580C',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>⚠️ Situación Especial</button>
                )}
                {(selectedCliente.status==='activo'||selectedCliente.status==='situacion_especial') && (
                  <button onClick={()=>{cambiarStatusCliente(selectedCliente.id,'bloqueado');setSelectedCliente(null)}}
                    style={{padding:'8px 16px',background:'#EF4444',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>Bloquear</button>
                )}
                {(selectedCliente.status==='bloqueado'||selectedCliente.status==='situacion_especial') && (
                  <button onClick={()=>{cambiarStatusCliente(selectedCliente.id,'activo');setSelectedCliente(null)}}
                    style={{padding:'8px 16px',background:'#0F6E56',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>Reactivar</button>
                )}
                <button onClick={()=>setSelectedCliente(null)}
                  style={{padding:'8px 16px',border:`1px solid ${bdr}`,borderRadius:8,background:'none',cursor:'pointer',fontSize:13,color:text}}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SITUACIÓN ESPECIAL */}
        {showSitEspecialModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'1rem'}}>
            <div style={{background:card,borderRadius:16,width:'100%',maxWidth:460,padding:'1.5rem',border:`1px solid ${bdr}`}}>
              <h3 style={{fontWeight:700,fontSize:16,color:'#C2410C',marginBottom:8}}>⚠️ Marcar Situación Especial</h3>
              <p style={{fontSize:13,color:sub,marginBottom:'1rem'}}>Esta acción restringe operaciones del cliente. Escribe el motivo detallado.</p>
              <div style={{marginBottom:'1rem'}}>
                <label style={{fontSize:12,color:sub,display:'block',marginBottom:4}}>Motivo *</label>
                <textarea value={sitEspecialNota} onChange={e=>setSitEspecialNota(e.target.value)}
                  placeholder="Ej: Cliente con adeudo vencido mayor a 30 días. Pendiente acuerdo de pago."
                  rows={4}
                  style={{width:'100%',padding:'9px 11px',border:`1px solid ${bdr}`,borderRadius:8,fontSize:13,color:text,background:bg,boxSizing:'border-box',resize:'vertical'}} />
              </div>
              <div style={{background:'#FFF0E0',border:'1px solid #EA580C',borderRadius:8,padding:'10px 12px',marginBottom:'1rem'}}>
                <p style={{fontSize:12,color:'#92400E',margin:0}}>⚠️ Solo <b>Admin</b> y <b>Gerente de Finanzas</b> pueden realizar este cambio. Quedará registrado con tu usuario, rol y fecha.</p>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button onClick={()=>setShowSitEspecialModal(false)}
                  style={{padding:'8px 16px',border:`1px solid ${bdr}`,borderRadius:8,background:'none',cursor:'pointer',fontSize:13,color:text}}>Cancelar</button>
                <button onClick={confirmarSitEspecial}
                  style={{padding:'8px 18px',background:'#EA580C',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>Confirmar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function TrackingMap({ drivers, dark }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const existing = document.getElementById('leaflet-css')
    if (!existing) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = window.L
      if (document.getElementById('admin-map')?._leaflet_id) return
      const map = L.map('admin-map').setView([19.4326, -99.1332], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      const active = drivers.filter(d => d.status === 'online')
      const baseCoords = [[19.4326,-99.1332],[19.4426,-99.1432],[19.4226,-99.1232]]
      active.forEach((d,i) => {
        const [lat,lng] = baseCoords[i%baseCoords.length]
        const icon = L.divIcon({
          html:`<div style="background:#0F6E56;color:#fff;padding:4px 8px;border-radius:20px;font-size:11px;white-space:nowrap;font-weight:600">🚚 ${d.user?.full_name?.split(' ')[0]||'Driver'}</div>`,
          className:'',iconAnchor:[40,12]
        })
        L.marker([lat+(Math.random()-.5)*.02,lng+(Math.random()-.5)*.02],{icon}).addTo(map)
      })
    }
    document.head.appendChild(script)
    return () => { try { window.L?.map('admin-map')?.remove() } catch(e){} }
  }, [drivers])
  return <div id="admin-map" style={{width:'100%',height:'100%'}} />
}