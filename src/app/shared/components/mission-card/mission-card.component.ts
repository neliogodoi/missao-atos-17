import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

type MissionCardStatus = 'active' | 'done' | 'locked';

@Component({
  selector: 'app-mission-card',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './mission-card.component.html',
  styleUrl: './mission-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MissionCardComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() status: MissionCardStatus = 'active';

  get isDone(): boolean {
    return this.status === 'done';
  }

  get isLocked(): boolean {
    return this.status === 'locked';
  }
}
