import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Database, 
  FileText, 
  Calendar, 
  Bell, 
  Settings,
  ShieldCheck,
  Building2,
  ChevronRight,
  LogOut
} from 'lucide-react';

const NavItem = ({ icon: Icon, label, isActive = false, badge }: any) => (
  <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
  }`}>
    <div className="flex items-center gap-3">
      <Icon size={20} />
      <span className="text-sm font-medium">{label}</span>
    </div>
    {badge && (
      <span className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </div>
);

const Sidebar = () => {
  return (
    <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col p-4 font-sans">
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold italic">
          G
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">INDUSTRIA <span className="text-blue-600">CAP</span></span>
      </div>

      <div className="flex-1 space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Principal</p>
        <NavItem icon={LayoutDashboard} label="Dashboard" isActive={true} />
        <NavItem icon={Users} label="Gestión Personal" />
        <NavItem icon={Building2} label="Estructura Org." />
        
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-6 mb-2">Capacitación</p>
        <NavItem icon={BookOpen} label="Catálogo Temas" />
        <NavItem icon={Database} label="Matrices Matriz" />
        <NavItem icon={Calendar} label="Programación" badge="3" />
        <NavItem icon={FileText} label="Documentación" />
        
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mt-6 mb-2">Cumplimiento</p>
        <NavItem icon={ShieldCheck} label="Normas STPS" />
        <NavItem icon={FileText} label="Generar DC3" />
        <NavItem icon={Bell} label="Alertas" badge="12" />
      </div>

      <div className="mt-auto border-t border-slate-100 pt-4 space-y-1">
        <NavItem icon={Settings} label="Configuración" />
        <div className="flex items-center gap-3 p-3 text-slate-500 hover:text-rose-600 cursor-pointer">
          <LogOut size={20} />
          <span className="text-sm font-medium">Cerrar Sesión</span>
        </div>
      </div>

      <div className="mt-6 p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-300"></div>
          <div>
            <p className="text-xs font-bold text-slate-900">Admin Usuario</p>
            <p className="text-[10px] text-slate-500">Super Administrador</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
