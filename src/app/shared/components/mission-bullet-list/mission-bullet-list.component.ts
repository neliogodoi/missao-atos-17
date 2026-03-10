import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-mission-bullet-list',
  standalone: true,
  imports: [NgFor],
  templateUrl: './mission-bullet-list.component.html',
  styleUrl: './mission-bullet-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MissionBulletListComponent {
  @Input() items: string[] = [];

  bulletFor(index: number): string {
    return index % 2 === 0 ? '➤' : '⚔️';
  }

  trackByIndex(index: number): number {
    return index;
  }
}
