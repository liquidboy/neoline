import { Component, Input } from '@angular/core';

@Component({
  selector: 'loading',
  template: `<img
    [ngClass]="{ 'theme-color': color === 'theme' }"
    src="assets/images/common/loading.svg"
    alt=""
  /> `,
  styleUrls: ['loading.component.scss'],
})
export class LoadingComponent {
  @Input() color: string;
  @Input() widtd: number;

  constructor() {}
}
