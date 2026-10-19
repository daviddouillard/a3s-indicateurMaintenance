import { Info } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  // Curseur (semaine, mois…) placé à droite du titre (en dessous, pleine largeur, sur smartphone)
  control?: ReactNode;
  // Note de périmètre, dépliée au clic / toucher sur l'icône ⓘ (pas de survol sur mobile)
  note?: string;
  className?: string;
  children: ReactNode;
}

// Pavé blanc du dashboard : en-tête compact (titre + note + curseur), puis un corps qui
// remplit la hauteur disponible (les graphiques s'y étirent sur grand écran).
export function Panel({ title, control, note, className = '', children }: PanelProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const noteId = useId();

  return (
    <section className={`bg-white rounded-2xl shadow-md flex flex-col min-h-0 ${className}`} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-0.5">
          <h2 className="text-lg font-bold text-fimavi-primary">{title}</h2>
          {note && (
            <button
              type="button"
              onClick={() => setNoteOpen((o) => !o)}
              aria-expanded={noteOpen}
              aria-controls={noteId}
              aria-label={`À propos : ${title}`}
              title={note}
              className={`flex h-10 w-10 lg:h-8 lg:w-8 items-center justify-center rounded-full transition-colors ${
                noteOpen ? 'text-orange-500' : 'text-gray-300 hover:text-gray-500'
              }`}
            >
              <Info size={16} />
            </button>
          )}
        </div>
        {control && <div className="w-full sm:w-auto">{control}</div>}
        {note && noteOpen && (
          <p id={noteId} className="w-full text-xs text-gray-500 pb-1">{note}</p>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-3 p-3 sm:p-4">{children}</div>
    </section>
  );
}
