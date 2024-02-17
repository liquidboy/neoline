/**
 * @license
 * Copyright (c) 2014, 2023, Oracle and/or its affiliates.
 * Licensed under The Universal Permissive License (UPL), Version 1.0
 * as shown at https://oss.oracle.com/licenses/upl/
 * @ignore
 */
import { h } from "preact";
import { useRef, useState, useEffect } from "preact/hooks";
import * as ResponsiveUtils from "ojs/ojresponsiveutils";
import "ojs/ojtoolbar";
import "ojs/ojmenu";
import "ojs/ojbutton";

type Props = Readonly<{
  appName: string,
  userLogin: string
}>;

export function Header({ appName, userLogin }: Props) {
  const mediaQueryRef = useRef<MediaQueryList>(window.matchMedia(ResponsiveUtils.getFrameworkQuery("sm-only")!));
  
  const [isSmallWidth, setIsSmallWidth] = useState(mediaQueryRef.current.matches);

  useEffect(() => {
    mediaQueryRef.current.addEventListener("change", handleMediaQueryChange);
    return (() => mediaQueryRef.current.removeEventListener("change", handleMediaQueryChange));
  }, [mediaQueryRef]);

  function handleMediaQueryChange(e: MediaQueryListEvent) {
    setIsSmallWidth(e.matches);
  }

  function getDisplayType() {
    return (isSmallWidth ? "icons" : "all");
  };

  function getEndIconClass() {
    return (isSmallWidth ? "oj-icon demo-appheader-avatar" : "oj-component-icon oj-button-menu-dropdown-icon");
  }

  return (
    <header role="banner" class="oj-web-applayout-header">
      <div class="oj-web-applayout-max-width oj-flex-bar oj-sm-align-items-center">
        <div class="oj-flex-bar-middle oj-sm-align-items-baseline">
          <span
            role="img"
            class="oj-icon demo-neo-icon"
            title="One Logo"
            alt="One Logo"></span>
          <h1
            class="oj-sm-only-hide oj-web-applayout-header-title"
            title="Application Name">
            {appName}
          </h1>
        </div>
        <div class="oj-flex-bar-end">
        
        </div>
      </div>
    </header>
  );  
}
