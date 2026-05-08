import React from 'react';
import { 
  Users, 
  BookOpen, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  BarChart3,
  Clock,
  Award
} from 'lucide-react';

const StatCard = ({ title, value, subValue, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold mt-1 text-slate-900">{value}</h3>
        {subValue && (
          <p className={`text-xs mt-1 ${subValue.includes('+') ? 'text-emerald-600' : 'text-slate-500'}`}>
            {subValue}
          </p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

const ExecutiveDashboard = () => {
  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Ejecutivo</h1>
          <p className="text-slate-500">Resumen integral de capacitación y cumplimiento industrial.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50">
            Exportar Reporte
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200">
            Nueva Capacitación
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Personal Total" 
          value="1,284" 
          subValue="+12 este mes" 
          icon={Users} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Cumplimiento Global" 
          value="84.2%" 
          subValue="Objetivo: 95%" 
          icon={CheckCircle} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Horas Hombre" 
          value="42,150" 
          subValue="Acumulado anual" 
          icon={Clock} 
          color="bg-violet-500" 
        />
        <StatCard 
          title="Cursos Vencidos" 
          value="18" 
          subValue="Requieren atención" 
          icon={AlertTriangle} 
          color="bg-orange-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Placeholder Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800">Cumplimiento por Departamento</h3>
              <select className="text-sm border-slate-200 rounded-md">
                <option>Todos los departamentos</option>
              </select>
            </div>
            {/* Mock Chart Visualization */}
            <div className="space-y-4">
              {[
                { dept: 'Producción', val: 92, color: 'bg-emerald-500' },
                { dept: 'Mantenimiento', val: 78, color: 'bg-amber-500' },
                { dept: 'Calidad', val: 95, color: 'bg-emerald-500' },
                { dept: 'Logística', val: 64, color: 'bg-rose-500' },
                { dept: 'RH', val: 88, color: 'bg-blue-500' },
              ].map((item) => (
                <div key={item.dept}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-600">{item.dept}</span>
                    <span className="font-bold text-slate-800">{item.val}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.val}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4">Próximas Sesiones</h3>
            <div className="divide-y divide-slate-100">
              {[
                { title: 'Seguridad en Alturas', date: '10 Mayo', time: '09:00', instructor: 'Ing. Perez', status: 'Confirmado' },
                { title: 'Norma STPS-035', date: '12 Mayo', time: '14:00', instructor: 'Lic. Ruiz', status: 'Programado' },
                { title: 'Manejo de Montacargas', date: '15 Mayo', time: '08:30', instructor: 'Certificador Ext.', status: 'Programado' },
              ].map((session, i) => (
                <div key={i} className="py-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-slate-900">{session.title}</h4>
                    <p className="text-xs text-slate-500">{session.date} • {session.time} • {session.instructor}</p>
                  </div>
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">
                    {session.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Alerts & KPI */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg shadow-slate-200">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-400" />
              Eficiencia del Mes
            </h3>
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center rounded-full border-4 border-emerald-400 w-24 h-24 mb-4">
                <span className="text-2xl font-bold">94%</span>
              </div>
              <p className="text-sm text-slate-400">Has superado la meta mensual en un +2.4%</p>
            </div>
            <button className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 py-2 rounded-lg text-sm font-bold transition-colors">
              Ver Detalles STPS
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              Top Certificaciones
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-500">1</div>
                <div>
                  <p className="text-sm font-bold">Soldadura TIG</p>
                  <p className="text-xs text-slate-500">42 Empleados</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-500">2</div>
                <div>
                  <p className="text-sm font-bold">Seguridad Eléctrica</p>
                  <p className="text-xs text-slate-500">38 Empleados</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
