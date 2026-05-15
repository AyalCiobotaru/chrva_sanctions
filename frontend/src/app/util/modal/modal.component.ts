import { Component, EventEmitter, HostListener, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss'
})
export class ModalComponent {
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
