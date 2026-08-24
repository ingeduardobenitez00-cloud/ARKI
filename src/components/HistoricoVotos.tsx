import React from 'react';

interface HistoricoVotosProps {
  voto1?: string;
  voto2?: string;
  voto3?: string;
  voto4?: string;
  voto5?: string;
  partido?: string;
  className?: string;
}

export const HistoricoVotos: React.FC<HistoricoVotosProps> = ({ voto1, voto2, voto3, voto4, voto5, partido, className = '' }) => {
  const elections = [
    { title: 'Int.Municip.', date: '20.Jun.21', val: voto1, bg: 'bg-[#c2e5b3]', titleColor: 'text-red-600' },
    { title: 'Elec.Municipal', date: '30.Oct.21', val: voto2, bg: 'bg-[#ebeab4]', titleColor: 'text-slate-900' },
    { title: 'Int.Presid.', date: '18.Dic.22', val: voto3, bg: 'bg-[#c2e5b3]', titleColor: 'text-red-600' },
    { title: 'Presidenciales', date: '30.Abr.23', val: voto4, bg: 'bg-[#ebeab4]', titleColor: 'text-slate-900' },
    { title: 'Int.Municip.', date: '07.Jun.26', val: voto5, bg: 'bg-[#c2e5b3]', titleColor: 'text-red-600' },
  ];

  return (
    <div className={`mt-2 flex flex-col items-center border border-slate-300 p-2 rounded-xl bg-[#e2f0d9]/50 shadow-inner ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-red-600 font-black text-sm uppercase tracking-tight">Historico de Votos</h3>
        {partido && <span className="bg-white border border-slate-300 text-slate-800 text-[9px] px-2 py-0.5 rounded-full font-black uppercase shadow-sm">{partido}</span>}
      </div>
      <div className="flex flex-nowrap justify-center gap-1 w-full overflow-hidden">
        {elections.map((elec, idx) => {
          const voted = elec.val?.toUpperCase() === 'S';
          return (
            <div key={idx} className={`${elec.bg} border border-slate-500/50 p-1 flex flex-col items-center justify-between w-16 shrink rounded shadow-sm`}>
              <div className="text-center w-full">
                <p className={`text-[8px] font-black ${elec.titleColor} leading-tight tracking-tighter truncate w-full`}>{elec.title}</p>
                <p className="text-[8px] font-bold text-slate-900 mt-[1px] tracking-tighter">{elec.date}</p>
              </div>
              <div className="bg-white border border-slate-300/50 w-5 h-5 flex items-center justify-center mt-1 rounded-sm shadow-inner">
                {voted && <span className="text-red-600 font-black text-xs">S</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
