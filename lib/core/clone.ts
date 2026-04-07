/*
 ********************************************************************
 * typed-clone
 ********************************************************************
 *
 * @module clone
 *
 * This re-exports every public symbol of `@aedge-io/typed-clone`, since
 * it's already exposed through the public API via `CloneOptions` and
 * the `Cloned<T>` type and is a "sister project".
 *
 * No need to peer-dependency shenenigans.
 */

export type {
  Cloneable,
  Cloned,
  CloneOptions,
  InherentlyCloned,
  Ref,
  Unref,
} from "@aedge-io/typed-clone";
export {
  Clone,
  clone,
  isInherentlyCloneable,
  ref,
  unref,
} from "@aedge-io/typed-clone";
