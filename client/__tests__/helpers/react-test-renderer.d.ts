// `react-test-renderer@19.0.0` ships no type declarations (verified: no bundled `.d.ts`, and
// `@types/react-test-renderer` is not a dependency of this repo) -- adding that package just for
// types would violate this change's "no new dependency" constraint (design.md, Migration/Rollout).
// This declares only the surface `renderWithAct` and the render suites actually use.
declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  export interface ReactTestInstance {
    readonly type: unknown;
    readonly props: Record<string, unknown>;
    findAllByType(type: unknown): ReactTestInstance[];
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    toJSON(): unknown;
    readonly root: ReactTestInstance;
  }

  interface ReactTestRendererModule {
    create(element: ReactElement): ReactTestRenderer;
  }

  const reactTestRenderer: ReactTestRendererModule;
  export default reactTestRenderer;
}
