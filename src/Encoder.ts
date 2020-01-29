/**
 * TODO
 * - optimize encode when all encoders are noop
 *
 * @since 3.0.0
 */
import { Contravariant1 } from 'fp-ts/lib/Contravariant'
import { identity } from 'fp-ts/lib/function'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'
import { pipeable } from 'fp-ts/lib/pipeable'
import * as G from './Guard'
import * as S from './Schemable'
import { memoize } from './util'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * @since 3.0.0
 */
export interface Encoder<A> {
  readonly encode: (a: A) => unknown
}

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

/**
 * @since 3.0.0
 */
export function literals<A extends S.Literal>(_as: NonEmptyArray<A>): Encoder<A> {
  return id
}

/**
 * @since 3.0.0
 */
export function literalsOr<A extends S.Literal, B>(as: NonEmptyArray<A>, encoder: Encoder<B>): Encoder<A | B> {
  const literals = G.literals(as)
  return {
    encode: ab => (literals.is(ab) ? ab : encoder.encode(ab))
  }
}

// -------------------------------------------------------------------------------------
// primitives
// -------------------------------------------------------------------------------------

/**
 * @since 3.0.0
 */
export const id: Encoder<unknown> = {
  encode: identity
}

/**
 * @since 3.0.0
 */
export const string: Encoder<string> = id

/**
 * @since 3.0.0
 */
export const number: Encoder<number> = id

/**
 * @since 3.0.0
 */
export const boolean: Encoder<boolean> = id

/**
 * @since 3.0.0
 */
export const UnknownArray: Encoder<Array<unknown>> = id

/**
 * @since 3.0.0
 */
export const UnknownRecord: Encoder<Record<string, unknown>> = id

/**
 * @since 3.0.0
 */
export const Int: Encoder<S.Int> = id

// -------------------------------------------------------------------------------------
// combinators
// -------------------------------------------------------------------------------------

/**
 * @since 3.0.0
 */
export function type<A>(encoders: { [K in keyof A]: Encoder<A[K]> }): Encoder<A> {
  return {
    encode: a => {
      const o: Record<string, unknown> = {}
      for (const k in encoders) {
        o[k] = encoders[k].encode(a[k])
      }
      return o
    }
  }
}

/**
 * @since 3.0.0
 */
export function partial<A>(encoders: { [K in keyof A]: Encoder<A[K]> }): Encoder<Partial<A>> {
  return {
    encode: a => {
      const o: Record<string, unknown> = {}
      for (const k in encoders) {
        const v: A[Extract<keyof A, string>] | undefined = a[k]
        if (v !== undefined) {
          o[k] = encoders[k].encode(v)
        }
      }
      return o
    }
  }
}

/**
 * @since 3.0.0
 */
export function record<A>(encoder: Encoder<A>): Encoder<Record<string, A>> {
  return {
    encode: r => {
      const o: Record<string, unknown> = {}
      for (const k in r) {
        o[k] = encoder.encode(r[k])
      }
      return o
    }
  }
}

/**
 * @since 3.0.0
 */
export function array<A>(encoder: Encoder<A>): Encoder<Array<A>> {
  return {
    encode: as => as.map(encoder.encode)
  }
}

/**
 * @since 3.0.0
 */
export function tuple<A, B, C, D, E>(
  encoders: [Encoder<A>, Encoder<B>, Encoder<C>, Encoder<D>, Encoder<E>]
): Encoder<[A, B, C, D, E]>
export function tuple<A, B, C, D>(encoders: [Encoder<A>, Encoder<B>, Encoder<C>, Encoder<D>]): Encoder<[A, B, C, D]>
export function tuple<A, B, C>(encoders: [Encoder<A>, Encoder<B>, Encoder<C>]): Encoder<[A, B, C]>
export function tuple<A, B>(encoders: [Encoder<A>, Encoder<B>]): Encoder<[A, B]>
export function tuple<A>(encoders: [Encoder<A>]): Encoder<[A]>
export function tuple(encoders: Array<Encoder<unknown>>): Encoder<Array<unknown>> {
  return {
    encode: as => encoders.map((encoder, i) => encoder.encode(as[i]))
  }
}

/**
 * @since 3.0.0
 */
export function intersection<A, B, C, D, E>(
  encoders: [Encoder<A>, Encoder<B>, Encoder<C>, Encoder<D>, Encoder<E>]
): Encoder<A & B & C & D & E>
export function intersection<A, B, C, D>(
  encoders: [Encoder<A>, Encoder<B>, Encoder<C>, Encoder<D>]
): Encoder<A & B & C & D>
export function intersection<A, B, C>(encoders: [Encoder<A>, Encoder<B>, Encoder<C>]): Encoder<A & B & C>
export function intersection<A, B>(encoders: [Encoder<A>, Encoder<B>]): Encoder<A & B>
export function intersection<A>(encoders: Array<Encoder<A>>): Encoder<A> {
  return {
    encode: a => {
      const us: Array<unknown> = encoders.map(encoder => encoder.encode(a))
      return us.some(u => Object.prototype.toString.call(u) !== '[object Object]')
        ? us[us.length - 1]
        : Object.assign({}, ...us)
    }
  }
}

/**
 * @since 3.0.0
 */
export function lazy<A>(f: () => Encoder<A>): Encoder<A> {
  const get = memoize(f)
  return {
    encode: a => get().encode(a)
  }
}

/**
 * @since 3.0.0
 */
export function sum<T extends string>(
  tag: T
): <A>(encoders: { [K in keyof A]: Encoder<A[K] & Record<T, K>> }) => Encoder<A[keyof A]> {
  return (encoders: any) => {
    return {
      encode: (a: any) => encoders[a[tag]].encode(a)
    }
  }
}

// -------------------------------------------------------------------------------------
// instances
// -------------------------------------------------------------------------------------

/**
 * @since 3.0.0
 */
export const URI = 'Encoder'

/**
 * @since 3.0.0
 */
export type URI = typeof URI

declare module 'fp-ts/lib/HKT' {
  interface URItoKind<A> {
    readonly Encoder: Encoder<A>
  }
}

/**
 * @since 3.0.0
 */
export const encoder: Contravariant1<URI> & S.Schemable<URI> & S.WithInt<URI> & S.WithLazy<URI> = {
  URI,
  contramap: (fa, f) => ({
    encode: b => fa.encode(f(b))
  }),
  literals,
  literalsOr,
  string,
  number,
  boolean,
  UnknownArray,
  UnknownRecord,
  type,
  partial,
  record,
  array,
  tuple,
  intersection,
  sum,
  Int,
  lazy
}

const { contramap } = pipeable(encoder)

export {
  /**
   * @since 3.0.0
   */
  contramap
}