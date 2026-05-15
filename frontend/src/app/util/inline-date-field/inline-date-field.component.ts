import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-inline-date-field',
  standalone: true,
  templateUrl: './inline-date-field.component.html',
  styleUrl: './inline-date-field.component.scss'
})
export class InlineDateFieldComponent {
  @Input() value: string | null = null;
  @Input() saving = false;
  @Input() label = 'Date';

  @Output() valueChanged = new EventEmitter<string | null>();

  update(value: string): void {
    this.valueChanged.emit(value || null);
  }

  clear(): void {
    this.valueChanged.emit(null);
  }
}
