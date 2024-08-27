import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  AssetState,
  ChromeService,
  GlobalService,
  SettingState,
} from '@/app/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NEO, GAS, Asset } from '@/models/models';
import { MatDialog } from '@angular/material/dialog';
import {
  PopupAddNetworkDialogComponent,
  PopupConfirmDialogComponent,
} from '@popup/_dialogs';
import BigNumber from 'bignumber.js';
import {
  NEO3_CONTRACT,
  GAS3_CONTRACT,
  ChainType,
  RpcNetwork,
} from '../../_lib';
import { Store } from '@ngrx/store';
import { AppState } from '@/app/reduers';
import { Unsubscribable } from 'rxjs';
import { ETH_SOURCE_ASSET_HASH } from '../../_lib/evm';

@Component({
  templateUrl: 'asset-detail.component.html',
  styleUrls: ['asset-detail.component.scss'],
})
export class PopupAssetDetailComponent implements OnInit, OnDestroy {
  assetId: string;
  balance: Asset;
  rateCurrency: string;

  showMenu = false;
  canHideBalance = false;
  private watch: Asset[]; // User-added assets

  private accountSub: Unsubscribable;
  networkId: number;
  private address;
  chainType: ChainType;
  private n2Network: RpcNetwork;
  private n3Network: RpcNetwork;
  private n3NetworkIndex: number;
  private neoXNetwork: RpcNetwork;
  private neoXNetworkIndex: number;
  constructor(
    private assetState: AssetState,
    private aRouter: ActivatedRoute,
    private chrome: ChromeService,
    private dialog: MatDialog,
    private global: GlobalService,
    private router: Router,
    private settingState: SettingState,
    private store: Store<AppState>
  ) {
    const account$ = this.store.select('account');
    this.accountSub = account$.subscribe((state) => {
      this.address = state.currentWallet?.accounts[0]?.address;
      this.chainType = state.currentChainType;
      this.n2Network = state.n2Networks[state.n2NetworkIndex];
      this.n3Network = state.n3Networks[state.n3NetworkIndex];
      this.n3NetworkIndex = state.n3NetworkIndex;
      this.neoXNetwork = state.neoXNetworks[state.neoXNetworkIndex];
      this.neoXNetworkIndex = state.neoXNetworkIndex;
      switch (this.chainType) {
        case 'Neo2':
          this.networkId = this.n2Network.id;
          break;
        case 'Neo3':
          this.networkId = this.n3Network.id;
          break;
        case 'NeoX':
          this.networkId = this.neoXNetwork.id;
          break;
      }
      this.initData();
    });
  }

  initData() {
    this.aRouter.queryParams.subscribe((params) => {
      this.assetId = params.assetId;
      this.assetState.getAssetDetail(this.address, this.assetId).then((res) => {
        this.balance = res;
        this.getAssetDetail();
        this.getCanHide();
      });
    });
  }

  ngOnInit(): void {
    this.settingState.rateCurrencySub.subscribe((res) => {
      this.rateCurrency = res;
    });
  }

  ngOnDestroy(): void {
    this.accountSub?.unsubscribe();
  }

  getCanHide() {
    const index = [
      NEO,
      GAS,
      NEO3_CONTRACT,
      GAS3_CONTRACT,
      ETH_SOURCE_ASSET_HASH,
    ].indexOf(this.assetId);
    this.canHideBalance = index >= 0 ? false : true;
    if (this.canHideBalance) {
      this.chrome
        .getWatch(`${this.chainType}-${this.networkId}`, this.address)
        .subscribe((res) => {
          this.watch = res;
        });
    }
  }

  async getAssetDetail() {
    const balance = await this.assetState.getAddressAssetBalance(
      this.address,
      this.assetId,
      this.chainType
    );
    this.balance.balance = new BigNumber(balance)
      .shiftedBy(-this.balance.decimals)
      .toFixed();
    this.getAssetRate();
  }

  getAssetRate() {
    this.assetState
      .getAssetAmountRate({
        chainType: this.chainType,
        assetId: this.balance.asset_id,
        chainId:
          this.chainType === 'NeoX' ? this.neoXNetwork.chainId : undefined,
        amount: this.balance.balance,
      })
      .then((res) => {
        this.balance.rateBalance = res;
      });
  }

  hideBalance() {
    this.dialog
      .open(PopupConfirmDialogComponent, {
        data: 'delAssetTip',
        panelClass: 'custom-dialog-panel',
        backdropClass: 'custom-dialog-backdrop',
      })
      .afterClosed()
      .subscribe((confirm) => {
        if (confirm) {
          const i = this.watch.findIndex((w) => w.asset_id === this.assetId);
          if (i >= 0) {
            this.watch.splice(i, 1);
          } else {
            this.balance.watching = false;
            this.watch.push(this.balance);
          }
          this.chrome.setWatch(
            `${this.chainType}-${this.networkId}`,
            this.address,
            this.watch
          );
          this.global.snackBarTip('hiddenSucc');
          this.router.navigateByUrl('/popup/home');
        }
      });
  }

  toWeb() {
    this.showMenu = false;
    switch (this.chainType) {
      case 'Neo2':
        const isNep5 = this.assetId !== NEO && this.assetId !== GAS;
        if (this.n2Network.explorer) {
          window.open(
            `${this.n2Network.explorer}${isNep5 ? 'nep5' : 'asset'}/${
              this.assetId
            }/page/1`
          );
        }
        break;
      case 'Neo3':
        if (this.n3Network.explorer) {
          window.open(`${this.n3Network.explorer}tokens/nep17/${this.assetId}`);
        } else {
          this.dialog.open(PopupAddNetworkDialogComponent, {
            panelClass: 'custom-dialog-panel',
            backdropClass: 'custom-dialog-backdrop',
            data: {
              addChainType: this.chainType,
              index: this.n3NetworkIndex,
              editNetwork: this.n3Network,
              addExplorer: true,
            },
          });
        }
        break;
      case 'NeoX':
        if (this.neoXNetwork.explorer) {
          window.open(`${this.neoXNetwork.explorer}/address/${this.address}`);
        } else {
          this.dialog.open(PopupAddNetworkDialogComponent, {
            panelClass: 'custom-dialog-panel',
            backdropClass: 'custom-dialog-backdrop',
            data: {
              addChainType: this.chainType,
              index: this.neoXNetworkIndex,
              editNetwork: this.neoXNetwork,
              addExplorer: true,
            },
          });
        }
        break;
    }
  }
}
