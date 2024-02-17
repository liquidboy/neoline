import { ExtendGlobalProps, registerCustomElement } from "ojs/ojvcomponent";
import { h, ComponentProps, ComponentType } from "preact";
import componentStrings = require("ojL10n!./resources/nls/wallet-manager-strings");
import "css!./wallet-manager-styles.css";

type Props = Readonly<{
  message?: string;
}>;

/**
 * 
 * @ojmetadata version "1.0.0"
 * @ojmetadata displayName "A user friendly, translatable name of the component"
 * @ojmetadata description "A translatable high-level description for the component"
 * 
 */
function WalletManagerImpl(
  { message = "Hello from  wallet-manager" }: Props
) {
  return <p>{message}</p>
}

export const WalletManager: ComponentType <
  ExtendGlobalProps < ComponentProps < typeof WalletManagerImpl>>
> = registerCustomElement(
    "wallet-manager",
  WalletManagerImpl
);