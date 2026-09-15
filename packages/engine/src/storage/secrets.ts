import type { StorageProvider } from './provider'
import type { Variable, Environment } from '../types/variables'

/**
 * Abstraction over a platform secure store. The desktop app implements this
 * with Electron `safeStorage`; tests use a reversible fake. Values flagged
 * `secret` are routed through the codec so they are never persisted plaintext.
 */
export interface SecretCodec {
  isAvailable(): boolean
  encrypt(plaintext: string): string
  decrypt(payload: string): string
}

function enc(codec: SecretCodec, variable: Variable): Variable {
  if (!variable.secret || !codec.isAvailable()) return variable
  return {
    ...variable,
    initialValue: codec.encrypt(variable.initialValue),
    currentValue: codec.encrypt(variable.currentValue),
  }
}

function dec(codec: SecretCodec, variable: Variable): Variable {
  if (!variable.secret || !codec.isAvailable()) return variable
  try {
    return {
      ...variable,
      initialValue: codec.decrypt(variable.initialValue),
      currentValue: codec.decrypt(variable.currentValue),
    }
  } catch {
    return variable
  }
}

function encEnv(codec: SecretCodec, env: Environment): Environment {
  return { ...env, variables: env.variables.map((v) => enc(codec, v)) }
}

function decEnv(codec: SecretCodec, env: Environment): Environment {
  return { ...env, variables: env.variables.map((v) => dec(codec, v)) }
}

/**
 * Wraps a {@link StorageProvider} so secret environment / global variable
 * values are encrypted on write and decrypted on read. Every other call is a
 * transparent delegation, so the result still satisfies `StorageProvider`.
 */
export function withSecretCodec(inner: StorageProvider, codec: SecretCodec): StorageProvider {
  const decrypted = (value: Environment | undefined): Environment | undefined =>
    value === undefined ? undefined : decEnv(codec, value)

  return new Proxy(inner, {
    get(target, prop, receiver) {
      switch (prop) {
        case 'saveEnvironment':
          return (environment: Environment) => target.saveEnvironment(encEnv(codec, environment))
        case 'getEnvironment': {
          const fn = target.getEnvironment.bind(target)
          return (id: string) => decrypted(fn(id))
        }
        case 'listEnvironments':
          return (workspaceId: string) =>
            target.listEnvironments(workspaceId).map((e) => decEnv(codec, e))
        case 'saveGlobalVariable':
          return (variable: Variable) => target.saveGlobalVariable(enc(codec, variable))
        case 'listGlobalVariables':
          return (workspaceId: string) =>
            target.listGlobalVariables(workspaceId).map((v) => dec(codec, v))
        default: {
          const value = Reflect.get(target, prop, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        }
      }
    },
  })
}