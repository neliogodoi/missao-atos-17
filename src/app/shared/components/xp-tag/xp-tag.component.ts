import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type XpTagVariant = 'gold' | 'amethyst' | 'streak';
export type XpTagSize = 'md' | 'xl';

@Component({
  selector: 'app-xp-tag',
  standalone: true,
  templateUrl: './xp-tag.component.html',
  styleUrl: './xp-tag.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class XpTagComponent {
  @Input({ required: true }) value!: number;
  @Input() label = 'XP';
  @Input() variant: XpTagVariant = 'gold';
  @Input() showPlus = true;
  @Input() size: XpTagSize = 'md';
}
