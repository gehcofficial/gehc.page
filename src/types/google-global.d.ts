declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>,
          ) => {
            addListener: (event: string, handler: () => void) => void;
            getPlace: () => Record<string, unknown>;
          };
        };
        Map: new (el: HTMLElement, opts?: Record<string, unknown>) => {
          setCenter: (pos: { lat: number; lng: number }) => void;
          setZoom: (z: number) => void;
        };
        Marker: new (opts?: Record<string, unknown>) => {
          setPosition: (pos: { lat: number; lng: number }) => void;
          addListener: (event: string, handler: () => void) => void;
          getPosition: () => { lat: () => number; lng: () => number } | null;
        };
        event?: {
          clearInstanceListeners: (instance: unknown) => void;
        };
      };
    };
  }
}

export {};
