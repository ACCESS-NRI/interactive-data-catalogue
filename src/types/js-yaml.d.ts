declare module 'js-yaml' {
  export function load(text: string, options?: any): any;
  export function safeLoad(text: string, options?: any): any;
  export function dump(obj: any, options?: any): string;
  const _default: {
    load: typeof load;
    safeLoad: typeof safeLoad;
    dump: typeof dump;
  };
  export default _default;
}
