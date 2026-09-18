import type { ReactNode } from 'react';
import { Eyebrow } from '../ui';

/*
  診断の各stepに「章」としての顔を与える。
  入力欄の羅列の前に、いま何を整理しているのか・なぜ聞くのかを置くことで、
  ユーザーの体験を「フォーム記入」から「自分の状況の棚卸し」に変える。
*/
export function StepIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <header className="mb-8">
      <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>
      <h2 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.025em] text-ink leading-[1.15]">{title}</h2>
      {lead && <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-ink-muted max-w-xl">{lead}</p>}
      <hr className="rule-fade mt-7" />
    </header>
  );
}

/*
  設問のまとまり。関連する項目を小見出し付きで束ねることで、
  1画面に10個の入力欄が平坦に並ぶ状態を避ける。
*/
export function FieldGroup({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="mb-9 last:mb-0">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint whitespace-nowrap shrink-0">{title}</h3>
        <hr className="rule-fade flex-1 min-w-0" />
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {description && <p className="text-[13px] leading-relaxed text-ink-muted mb-5">{description}</p>}
      {children}
    </section>
  );
}

/** 2項目を横に並べる標準グリッド。単独項目は幅いっぱいのまま残す */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">{children}</div>;
}
