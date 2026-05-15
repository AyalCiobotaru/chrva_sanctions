import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-inline-checkbox-field',
  standalone: true,
  templateUrl: './inline-checkbox-field.component.html',
  styleUrl: './inline-checkbox-field.component.scss'
})
export class InlineCheckboxFieldComponent {
  @Input() checked = false;
  @Input() saving = false;
  @Input() label = '';

  @Output() checkedChanged = new EventEmitter<boolean>();

  update(checked: boolean): void {
    this.checkedChanged.emit(checked);
  }
}
