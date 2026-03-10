import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';

@Component({
  selector: 'app-scroll-panel',
  standalone: true,
  templateUrl: './scroll-panel.component.html',
  styleUrl: './scroll-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScrollPanelComponent implements OnChanges {
  @Input({ required: true }) title!: string;
  @Input() icon = '📜';
  @Input() collapsed = true;

  isExpanded = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['collapsed']) {
      this.isExpanded = !this.collapsed;
    }
  }

  toggle(): void {
    this.isExpanded = !this.isExpanded;
  }

  onHeaderSpace(event: Event): void {
    event.preventDefault();
    this.toggle();
  }
}
