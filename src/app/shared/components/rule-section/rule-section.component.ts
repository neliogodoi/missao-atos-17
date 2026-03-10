import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-rule-section',
  standalone: true,
  templateUrl: './rule-section.component.html',
  styleUrl: './rule-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RuleSectionComponent {
  @Input({ required: true }) title!: string;
  @Input() icon = '📘';
}
