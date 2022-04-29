import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { Wallet as Wallet2 } from '@cityofzion/neon-core/lib/wallet';
import { Wallet as Wallet3 } from '@cityofzion/neon-core-neo3/lib/wallet';
import { NeonService, ChromeService, GlobalService } from '@/app/core';
import { Router } from '@angular/router';
import { EVENT } from '@/models/dapi';
import { PopupSelectDialogComponent } from '../select/select.dialog';
import { ChainTypeGroups, ChainType, STORAGE_NAME } from '@popup/_lib';
import { PopupPasswordDialogComponent } from '../password/password.dialog';
import Sortable from 'sortablejs';

@Component({
    templateUrl: 'home-menu.dialog.html',
    styleUrls: ['home-menu.dialog.scss'],
})
export class PopupHomeMenuDialogComponent implements OnInit {
    @ViewChild('walletContainer') private walletContainer: ElementRef;
    private walletArr: {
        Neo2: Array<Wallet2 | Wallet3>;
        Neo3: Array<Wallet2 | Wallet3>;
    } = {
        Neo2: [],
        Neo3: [],
    };
    public displayWalletArr: Array<Wallet2 | Wallet3> = [];
    public wallet: Wallet2 | Wallet3;
    public tabType: ChainType;
    isSearching = false;
    constructor(
        private router: Router,
        private chrome: ChromeService,
        private dialogRef: MatDialogRef<PopupHomeMenuDialogComponent>,
        private neon: NeonService,
        private global: GlobalService,
        private dialog: MatDialog
    ) {
        this.walletArr.Neo2 = this.neon.neo2WalletArr;
        this.walletArr.Neo3 = this.neon.neo3WalletArr;
        this.wallet = this.neon.wallet;
        this.tabType = this.neon.currentWalletChainType;
        this.displayWalletArr = this.walletArr[this.tabType];
    }
    ngOnInit(): void {
        this.dragSort();
    }
    dragSort() {
        const el = document.getElementsByClassName('address-list')[0];
        Sortable.create(el, {
            onEnd: (/**Event*/evt) => {
                this.neon.sortWallet(this.tabType, evt.oldIndex, evt.newIndex);
            },
        });
    }
    public isActivityWallet(w: Wallet2 | Wallet3) {
        if (w.accounts[0].address === this.wallet.accounts[0].address) {
            return true;
        } else {
            return false;
        }
    }

    public dismiss() {
        this.dialogRef.close();
    }

    public selectAccount(w: Wallet2 | Wallet3) {
        this.dialog
            .open(PopupPasswordDialogComponent, {
                data: { account: w, chainType: this.tabType },
                panelClass: 'custom-dialog-panel',
            })
            .afterClosed()
            .subscribe((res) => {
                if (res) {
                    this.wallet = this.neon.parseWallet(w);
                    this.chrome.setWallet(this.wallet.export());
                    location.href = `index.html#popup`;
                    this.chrome.setHaveBackupTip(null);
                }
            });
    }

    public lock() {
        this.global.$wallet.next('close');
        this.dialogRef.close('lock');
        this.chrome.setLogin(true);
        this.router.navigateByUrl('/popup/login');
    }

    to(type: 'create' | 'import') {
        this.dismiss();
        this.dialog
            .open(PopupSelectDialogComponent, {
                data: {
                    optionGroup: ChainTypeGroups,
                    type: 'chain',
                },
                panelClass: 'custom-dialog-panel',
            })
            .afterClosed()
            .subscribe((chain) => {
                if (!chain) {
                    return;
                }
                if (type === 'create') {
                    this.router.navigateByUrl('/popup/wallet/create');
                } else {
                    this.router.navigateByUrl('/popup/wallet/import');
                }
            });
    }

    public exportWallet() {
        const sJson = JSON.stringify(this.neon.wallet.export());
        const element = document.createElement('a');
        element.setAttribute(
            'href',
            'data:text/json;charset=UTF-8,' + encodeURIComponent(sJson)
        );
        element.setAttribute('download', `${this.neon.wallet.name}.json`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    changeTabType(type: ChainType) {
        this.tabType = type;
        this.displayWalletArr = this.walletArr[type];
    }

    searchWallet($event) {
        let value: string = $event.target.value;
        value = value.trim().toLowerCase();
        if (value === '') {
            this.isSearching = false;
            this.displayWalletArr = this.walletArr[this.tabType];
            return;
        }
        this.isSearching = true;
        this.displayWalletArr = this.walletArr[this.tabType].filter((item) =>
            item.name.toLowerCase().includes(value)
        );
    }
}
