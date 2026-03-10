import { NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, from, of, switchMap, combineLatest } from 'rxjs';

import { DailyMission, Question, Season, UserAnswer } from '../../../../models/firestore.models';
import { AuthService } from '../../../../services/auth.service';
import { GameRepository } from '../../../../services/game-repository.service';
import { GameScoringService } from '../../../../services/game-scoring.service';
import { MissionCardComponent } from '../../../../shared/components/mission-card/mission-card.component';
import { XpTagComponent } from '../../../../shared/components/xp-tag/xp-tag.component';

interface JourneyDayStatus {
	dateKey: string;
	label: string;
	done: boolean;
}

interface ForgeItemVm {
	name: string;
	imageSrc: string;
	isCurrentWorkItem: boolean;
	progressPercent: number;
	earnedValue: number;
	targetValue: number;
	metricLabel: string;
	conquered: boolean;
	released: boolean;
	description: string;
}

const FORGE_ITEMS = ['Capacete', 'Peitoral', 'Cinto', 'Sandálias', 'Escudo', 'Espada'] as const;
type ForgeItemName = (typeof FORGE_ITEMS)[number];
const ITEM_BUILD_TARGET_PARTICIPATIONS = 5;
const FORGE_ITEM_IMAGE_MAP: Record<(typeof FORGE_ITEMS)[number], string> = {
	Capacete: 'assets/imgs/capacete.jpeg',
	Peitoral: 'assets/imgs/peitoral.jpeg',
	Cinto: 'assets/imgs/cinto.jpeg',
	Sandálias: 'assets/imgs/sandalias.jpeg',
	Escudo: 'assets/imgs/escudo.jpeg',
	Espada: 'assets/imgs/espada.jpeg'
};

@Component({
	selector: 'app-journey-page',
	imports: [NgIf, NgFor, MissionCardComponent, XpTagComponent],
	templateUrl: './journey-page.html',
	styleUrl: './journey-page.css'
})
export class JourneyPage {
	private readonly destroyRef = inject(DestroyRef);
	private readonly authService = inject(AuthService);
	private readonly gameRepository = inject(GameRepository);
	private readonly gameScoringService = inject(GameScoringService);

	private readonly missionCache = new Map<string, DailyMission>();
	private readonly questionCache = new Map<string, Question>();

	readonly loading = signal(true);
	readonly errorMessage = signal<string | null>(null);

	readonly seasonName = signal<string | null>(null);
	readonly seasonRange = signal<string | null>(null);
	readonly actItemName = signal<ForgeItemName | null>(null);
	readonly actNumber = signal<number | null>(null);
	readonly totalXp = signal(0);
	readonly streak = signal(0);
	readonly historyDays = signal<JourneyDayStatus[]>([]);
	readonly itemParticipations = signal<Record<ForgeItemName, number>>(this.createEmptyParticipationMap());
	readonly forgeOrder = signal<ForgeItemName[]>([...FORGE_ITEMS]);

	readonly forgeItems = computed<ForgeItemVm[]>(() => {
		const participations = this.itemParticipations();
		const currentActItem = this.actItemName();
		const orderedItems = this.forgeOrder();

		return orderedItems.map((name) => {
			const isCurrentWorkItem = currentActItem === name;
			const totalParticipations = participations[name];
			const earnedValue = Math.min(totalParticipations, ITEM_BUILD_TARGET_PARTICIPATIONS);
			const released = totalParticipations >= ITEM_BUILD_TARGET_PARTICIPATIONS;

			return {
				name,
				imageSrc: FORGE_ITEM_IMAGE_MAP[name],
				isCurrentWorkItem,
				earnedValue,
				targetValue: ITEM_BUILD_TARGET_PARTICIPATIONS,
				metricLabel: 'participações',
				conquered: released,
				released,
				progressPercent: Math.round((earnedValue / ITEM_BUILD_TARGET_PARTICIPATIONS) * 100),
				description: this.buildForgeDescription(name, isCurrentWorkItem, earnedValue, released)
			};
		});
	});

	readonly actSubtitle = computed(() => {
		const number = this.actNumber();
		const item = this.actItemName() ?? 'Item não definido';
		const range = this.seasonRange();

		if (number === null || !range) {
			return 'Ato atual';
		}

		return `Ato ${number}: ${item} - ${range}`;
	});

	constructor() {
		this.loadJourney();
	}

	private loadJourney(): void {
		this.authService.user$
			.pipe(
				takeUntilDestroyed(this.destroyRef),
				switchMap((user) => {
					this.loading.set(true);
					this.errorMessage.set(null);

					if (!user) {
						this.resetState();
						this.loading.set(false);
						return of(null);
					}

					return this.gameRepository.getActiveSeason$().pipe(
						switchMap((season) => {
							if (!season) {
								this.resetState();
								this.loading.set(false);
								return of(null);
							}

							const startDateKey = this.toDateKey(season.startsAt);
							const endDateKey = this.toDateKey(season.endsAt);

							this.seasonName.set(season.name);
							this.seasonRange.set(
								`${this.formatDateKeyForUi(startDateKey, true)} -> ${this.formatDateKeyForUi(endDateKey, true)}`
							);
							this.actItemName.set(this.resolveActItemName(season.currentItemKey));

							return combineLatest([
								this.gameRepository.listUserAnswersInRange(user.uid, startDateKey, endDateKey),
								this.gameRepository.listMissionsInRange(startDateKey, endDateKey),
								this.gameRepository.listUserAnswers(user.uid),
								this.gameRepository.listSeasons$()
							]).pipe(
								switchMap(([answers, missions, allAnswers, allActs]) => {
									this.actNumber.set(this.computeActSequenceNumber(season, allActs));
									return from(this.computeJourneyStats(answers, missions, allAnswers, allActs));
								})
							);
						})
					);
				})
			)
			.subscribe({
				next: (stats) => {
					if (stats) {
						this.totalXp.set(stats.totalXp);
						this.streak.set(stats.streak);
						this.historyDays.set(this.buildParticipationHistory(stats.answeredDateKeys));
						this.itemParticipations.set(stats.itemParticipations);
						this.forgeOrder.set(stats.forgeOrder);
					}
					this.loading.set(false);
				},
				error: (error: unknown) => {
					const message = error instanceof Error ? error.message : 'Erro ao carregar jornada.';
					this.errorMessage.set(message);
					this.loading.set(false);
				}
			});
	}

	private async computeJourneyStats(
		answers: UserAnswer[],
		missions: DailyMission[],
		allAnswers: UserAnswer[],
		allActs: Season[]
	): Promise<{
		totalXp: number;
		streak: number;
		answeredDateKeys: string[];
		missionDateKeys: string[];
		itemParticipations: Record<ForgeItemName, number>;
		forgeOrder: ForgeItemName[];
	}> {
		const missionDateKeys = Array.from(new Set(missions.map((mission) => mission.dateKey))).sort((a, b) =>
			b.localeCompare(a)
		);
		const itemParticipations = this.computeItemParticipations(allAnswers, allActs);
		const forgeOrder = this.computeForgeOrder(allActs);

		if (answers.length === 0) {
			return { totalXp: 0, streak: 0, answeredDateKeys: [], missionDateKeys, itemParticipations, forgeOrder };
		}

		const sortedAnswers = [...answers].sort((a, b) => {
			if (a.dateKey === b.dateKey) {
				return a.createdAt.localeCompare(b.createdAt);
			}
			return a.dateKey.localeCompare(b.dateKey);
		});

		let totalXp = 0;

		for (const answer of sortedAnswers) {
			const mission = await this.getMissionCached(answer.missionId);
			const question = await this.getQuestionCached(mission.questionId);

			totalXp += this.gameScoringService.computeXpForMission(
				question,
				answer.selectedIndex,
				answer.comment ?? ''
			);
		}

		const streak = this.computeRecentStreak(sortedAnswers);
		const answeredDateKeys = Array.from(new Set(sortedAnswers.map((answer) => answer.dateKey)));

		return { totalXp, streak, answeredDateKeys, missionDateKeys, itemParticipations, forgeOrder };
	}

	private computeRecentStreak(answers: UserAnswer[]): number {
		if (answers.length === 0) {
			return 0;
		}

		const uniqueDateKeys = Array.from(new Set(answers.map((answer) => answer.dateKey))).sort((a, b) =>
			a.localeCompare(b)
		);

		let streakCount = 1;
		let cursor = uniqueDateKeys[uniqueDateKeys.length - 1];

		for (let i = uniqueDateKeys.length - 2; i >= 0; i -= 1) {
			const expected = this.gameScoringService.getYesterdayDateKey(cursor);
			if (uniqueDateKeys[i] !== expected) {
				break;
			}

			streakCount += 1;
			cursor = uniqueDateKeys[i];
		}

		return streakCount;
	}

	private async getMissionCached(missionId: string): Promise<DailyMission> {
		const cached = this.missionCache.get(missionId);
		if (cached) {
			return cached;
		}

		const mission = await firstValueFrom(this.gameRepository.getMissionById(missionId));
		this.missionCache.set(missionId, mission);
		return mission;
	}

	private async getQuestionCached(questionId: string): Promise<Question> {
		const cached = this.questionCache.get(questionId);
		if (cached) {
			return cached;
		}

		const question = await firstValueFrom(this.gameRepository.getQuestion(questionId));
		this.questionCache.set(questionId, question);
		return question;
	}

	private toDateKey(value: string): string {
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			return value;
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			throw new Error(`Data inválida no Ato: ${value}`);
		}

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	private resetState(): void {
		this.seasonName.set(null);
		this.seasonRange.set(null);
		this.actItemName.set(null);
		this.actNumber.set(null);
		this.totalXp.set(0);
		this.streak.set(0);
		this.historyDays.set([]);
		this.itemParticipations.set(this.createEmptyParticipationMap());
		this.forgeOrder.set([...FORGE_ITEMS]);
	}

	private normalizeKey(value: string): string {
		return value
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	private resolveActItemName(currentItemKey?: string): ForgeItemName | null {
		if (!currentItemKey || currentItemKey.trim().length === 0) {
			return null;
		}

		const normalizedKey = this.normalizeKey(currentItemKey);

		for (const itemName of FORGE_ITEMS) {
			const normalizedItemName = this.normalizeKey(itemName);
			if (normalizedKey.includes(normalizedItemName)) {
				return itemName;
			}
		}

		return null;
	}

	private buildForgeDescription(
		itemName: ForgeItemName,
		isCurrentWorkItem: boolean,
		earnedValue: number,
		released: boolean
	): string {
		if (!this.actItemName()) {
			return 'Defina o item atual do Ato no painel admin para direcionar a construção.';
		}

		if (released && isCurrentWorkItem) {
			return `${itemName} concluído. O progresso segue salvo para os próximos Atos.`;
		}

		if (released) {
			return `${itemName} já concluído (progresso preservado).`;
		}

		if (!isCurrentWorkItem) {
			if (earnedValue > 0) {
				return `Progresso salvo: faltam ${ITEM_BUILD_TARGET_PARTICIPATIONS - earnedValue} participação(ões).`;
			}
			return `No Ato atual, o ${itemName.toLowerCase()} não está em construção.`;
		}

		return `Item do Ato em construção: faltam ${ITEM_BUILD_TARGET_PARTICIPATIONS - earnedValue} participação(ões).`;
	}

	private createEmptyParticipationMap(): Record<ForgeItemName, number> {
		return {
			Capacete: 0,
			Peitoral: 0,
			Cinto: 0,
			Sandálias: 0,
			Escudo: 0,
			Espada: 0
		};
	}

	private computeItemParticipations(
		allAnswers: UserAnswer[],
		allActs: Season[]
	): Record<ForgeItemName, number> {
		const participationByItem = this.createEmptyParticipationMap();

		const acts = allActs
			.flatMap((act) => {
				const itemName = this.resolveActItemName(act.currentItemKey);
				if (!itemName) {
					return [];
				}

				try {
					return [
						{
							startDateKey: this.toDateKey(act.startsAt),
							endDateKey: this.toDateKey(act.endsAt),
							itemName
						}
					];
				} catch {
					return [];
				}
			})
			.sort((a, b) => b.startDateKey.localeCompare(a.startDateKey));

		for (const answer of allAnswers) {
			const itemName = this.getItemNameForDate(answer.dateKey, acts);
			if (itemName) {
				participationByItem[itemName] += 1;
			}
		}

		return participationByItem;
	}

	private computeForgeOrder(allActs: Season[]): ForgeItemName[] {
		const orderedFromActs = allActs
			.flatMap((act) => {
				const itemName = this.resolveActItemName(act.currentItemKey);
				if (!itemName) {
					return [];
				}

				try {
					return [{ itemName, startDateKey: this.toDateKey(act.startsAt) }];
				} catch {
					return [];
				}
			})
			.sort((a, b) => b.startDateKey.localeCompare(a.startDateKey))
			.map((entry) => entry.itemName);

		const uniqueOrdered: ForgeItemName[] = [];
		const seen = new Set<ForgeItemName>();
		for (const item of orderedFromActs) {
			if (!seen.has(item)) {
				seen.add(item);
				uniqueOrdered.push(item);
			}
		}

		for (const item of FORGE_ITEMS) {
			if (!seen.has(item)) {
				uniqueOrdered.push(item);
			}
		}

		return uniqueOrdered;
	}

	private computeActSequenceNumber(activeAct: Season, allActs: Season[]): number | null {
		const ordered = [...allActs].sort((a, b) => {
			const startCompare = this.toDateKey(a.startsAt).localeCompare(this.toDateKey(b.startsAt));
			if (startCompare !== 0) {
				return startCompare;
			}

			const createdA = a.createdAt ?? '';
			const createdB = b.createdAt ?? '';
			return createdA.localeCompare(createdB);
		});

		const indexById = ordered.findIndex((act) => act.id && act.id === activeAct.id);
		if (indexById >= 0) {
			return indexById + 1;
		}

		const fallbackIndex = ordered.findIndex(
			(act) =>
				act.name === activeAct.name &&
				act.startsAt === activeAct.startsAt &&
				act.endsAt === activeAct.endsAt
		);

		return fallbackIndex >= 0 ? fallbackIndex + 1 : null;
	}

	private getItemNameForDate(
		dateKey: string,
		acts: Array<{ startDateKey: string; endDateKey: string; itemName: ForgeItemName }>
	): ForgeItemName | null {
		const match = acts.find((act) => dateKey >= act.startDateKey && dateKey <= act.endDateKey);
		return match?.itemName ?? null;
	}

	private buildParticipationHistory(answeredDateKeys: string[]): JourneyDayStatus[] {
		return [...answeredDateKeys]
			.sort((a, b) => b.localeCompare(a))
			.slice(0, 5)
			.map((dateKey) => ({
				dateKey,
				label: this.formatDateKeyForUi(dateKey),
				done: true
			}));
	}

	private formatDateKeyForUi(dateKey: string, withYear = false): string {
		const date = new Date(`${dateKey}T00:00:00`);
		if (Number.isNaN(date.getTime())) {
			return dateKey;
		}

		return new Intl.DateTimeFormat('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: withYear ? 'numeric' : undefined
		}).format(date);
	}

}
