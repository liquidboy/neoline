/**
 * @license
 * Copyright (c) 2014, 2023, Oracle and/or its affiliates.
 * Licensed under The Universal Permissive License (UPL), Version 1.0
 * as shown at https://oss.oracle.com/licenses/upl/
 * @ignore
 */
import { h } from "preact";

type Props = {
  links?: FooterLink[]
}

type FooterLink = {
  name: string;
  linkId: string;
  linkTarget: string;
}

const _DEFAULT_LINKS: FooterLink[] = [
  {
    name: "About One",
    linkId: "aboutOne",
    linkTarget: "https://github.com/liquidboy/neoline"
  },
  {
    name: "Contact Us",
    linkId: "contactUs",
    linkTarget: "https://github.com/liquidboy"
  },
  {
    name: "License",
    linkId: "license",
    linkTarget: "https://github.com/liquidboy/neoline/blob/main/LICENSE"
  }
]

export function Footer({ links = _DEFAULT_LINKS } : Props ) {
  return (
    <footer class="oj-web-applayout-footer" role="contentinfo">
      <div class="oj-web-applayout-footer-item oj-web-applayout-max-width">
        <ul>
          {links.map((item) => (
            <li>
              <a id={item.linkId} href={item.linkTarget} target="_blank">
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div class="oj-web-applayout-footer-item oj-web-applayout-max-width oj-text-color-secondary oj-typography-body-sm">
        Copyright © 2023 Jose Fajardo and/or its affiliates All rights reserved.
      </div>
    </footer>
  );
}
