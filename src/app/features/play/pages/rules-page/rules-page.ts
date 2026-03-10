import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { GameRulesConfig, RulesSectionConfig } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';
import { MissionCardComponent } from '../../../../shared/components/mission-card/mission-card.component';
import { MissionBulletListComponent } from '../../../../shared/components/mission-bullet-list/mission-bullet-list.component';
import { RuleSectionComponent } from '../../../../shared/components/rule-section/rule-section.component';

@Component({
  selector: 'app-rules-page',
  imports: [RouterLink, MissionCardComponent, RuleSectionComponent, MissionBulletListComponent, AsyncPipe, NgFor, NgIf],
  templateUrl: './rules-page.html',
  styleUrl: './rules-page.css'
})
export class RulesPage {
  private readonly firestoreService = inject(FirestoreService);

  private readonly fallbackSections: RulesSectionConfig[] = [
    {
      title: 'Objetivo',
      icon: '🎯',
      paragraphs: [
        'Forjar a armadura espiritual com constância diária, aprender a Palavra e crescer em comunhão.'
      ],
      bullets: []
    },
    {
      title: 'Como funciona o Ato',
      icon: '📅',
      paragraphs: [],
      bullets: [
        'Atos de 90 dias.',
        'Cada período (ex.: 2 semanas) foca em um item da armadura (capacete, peitoral, etc.).',
        'A história guia a jornada (capítulos semanais + desafio diário).'
      ]
    },
    {
      title: 'Missão do Dia',
      icon: '📜',
      paragraphs: [],
      bullets: [
        'Todo dia abre uma missão (história + pergunta).',
        'Responda no app (4 alternativas).',
        'Só 1 resposta por dia (não dá pra editar).'
      ]
    },
    {
      title: 'Pontuação (XP)',
      icon: '⭐',
      paragraphs: [],
      bullets: [
        'Participação: +1 XP por responder.',
        'Acerto: +2 XP extras (total 3 XP no dia).',
        'Comentário relevante (mínimo de 50 caracteres): +3 XP extras, mesmo se errar.',
        'Com erro + comentário: 4 XP no dia.',
        'Com acerto + comentário: 6 XP no dia.',
        'O XP é calculado pelo registro das respostas.'
      ]
    },
    {
      title: 'Sequência (Streak)',
      icon: '🔥',
      paragraphs: [],
      bullets: [
        'Responder dias seguidos aumenta a sequência.',
        'Perder um dia zera a sequência.',
        'Incentivo: constância > pressa.'
      ]
    },
    {
      title: 'Armadura',
      icon: '🛡️',
      paragraphs: [],
      bullets: [
        'Progresso da armadura representa sua evolução no Ato.',
        'Cada item precisa de 5 participações para ser concluído.',
        'O progresso de cada item é preservado entre Atos.'
      ]
    },
    {
      title: 'Regras rápidas',
      icon: '✅',
      paragraphs: [],
      bullets: [
        'Seja honesto.',
        'Um por pessoa.',
        'Respeito nos rankings.',
        'Dúvidas: procurar o líder/admin.'
      ]
    }
  ];

  readonly sections$ = this.firestoreService.doc$<GameRulesConfig>('gameConfig/rules').pipe(
    map((doc) => {
      if (!doc || !Array.isArray(doc.sections)) {
        return this.fallbackSections;
      }

      const parsed = doc.sections
        .map((section) => this.normalizeSection(section))
        .filter((section): section is RulesSectionConfig => section !== null);

      return parsed.length > 0 ? parsed : this.fallbackSections;
    }),
    catchError(() => of(this.fallbackSections))
  );

  private normalizeSection(value: unknown): RulesSectionConfig | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const section = value as Partial<RulesSectionConfig>;
    if (typeof section.title !== 'string' || section.title.trim().length === 0) {
      return null;
    }

    const paragraphs = Array.isArray(section.paragraphs)
      ? section.paragraphs.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    const bullets = Array.isArray(section.bullets)
      ? section.bullets.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    return {
      title: section.title,
      icon: typeof section.icon === 'string' && section.icon.trim().length > 0 ? section.icon : '📘',
      paragraphs,
      bullets
    };
  }
}
