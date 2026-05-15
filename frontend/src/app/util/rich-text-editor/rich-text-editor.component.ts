import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import hljs from 'highlight.js/lib/core';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import { QuillEditorComponent } from 'ngx-quill';
import { QuillModules } from 'ngx-quill/config';

hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('javascript', javascript);
(globalThis as unknown as Record<string, unknown>)['hljs'] = hljs;

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [FormsModule, QuillEditorComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true
    }
  ],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss'
})
export class RichTextEditorComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = 'Compose an epic...';
  @Input() minHeight = '220px';

  value = '';
  disabled = false;

  readonly modules: QuillModules = {
    syntax: { hljs }
  };

  readonly beforeRender = async (): Promise<void> => {
    const { default: katex } = await import('katex');
    const globals = globalThis as unknown as Record<string, unknown>;
    globals['katex'] = katex;
  };

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  handleValueChange(value: string | null): void {
    this.value = value ?? '';
    this.onChange(this.value);
  }

  handleBlur(): void {
    this.onTouched();
  }
}
