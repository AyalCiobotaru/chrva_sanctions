import { Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface MultiSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-multi-select-dropdown',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectDropdownComponent),
      multi: true
    }
  ],
  templateUrl: './multi-select-dropdown.component.html',
  styleUrl: './multi-select-dropdown.component.scss'
})
export class MultiSelectDropdownComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() options: MultiSelectOption[] = [];
  @Input() placeholder = 'Select options';

  @Output() selectionChanged = new EventEmitter<string[]>();

  selectedValues: string[] = [];
  open = false;
  disabled = false;

  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  get selectedText(): string {
    const selected = this.options
      .filter((option) => this.selectedValues.includes(option.value))
      .map((option) => option.label);
    return selected.length > 0 ? selected.join(', ') : this.placeholder;
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown.escape')
  closeOnEscape(): void {
    this.close();
  }

  writeValue(value: string[] | null): void {
    this.selectedValues = Array.isArray(value) ? value : [];
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggleOpen(): void {
    if (this.disabled) {
      return;
    }

    this.open = !this.open;
    this.onTouched();
  }

  toggleOption(value: string): void {
    const selected = new Set(this.selectedValues);

    if (selected.has(value)) {
      selected.delete(value);
    } else {
      selected.add(value);
    }

    this.selectedValues = this.options
      .map((option) => option.value)
      .filter((optionValue) => selected.has(optionValue));
    this.onChange(this.selectedValues);
    this.selectionChanged.emit(this.selectedValues);
  }

  isSelected(value: string): boolean {
    return this.selectedValues.includes(value);
  }

  private close(): void {
    if (this.open) {
      this.open = false;
      this.onTouched();
    }
  }
}
