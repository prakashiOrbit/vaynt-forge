import type { StorageProvider, CollectionDraft, CollectionPatch, FolderDraft, FolderPatch } from './provider.js'
import type { Variable, Environment } from '../types/variables.js'
import type { AuthConfig, KeyValuePair, RequestBody, RequestModel } from '../types/request.js'

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
 * A `{{variable}}` reference isn't itself a secret — the real secret lives
 * in whatever it resolves to (an environment/global/collection variable,
 * separately encrypted above). Encrypting the *template string* instead of
 * the value it points at would protect nothing (a key name isn't
 * sensitive) while actively breaking anything that reads this field without
 * a working codec — notably `apps/cli`, which has no OS-keychain access and
 * would otherwise get back ciphertext instead of a resolvable `{{token}}`
 * for the *recommended* way to keep a secret out of an auth/header field.
 * Only a literal, hardcoded value here (the discouraged-but-supported
 * alternative) actually needs — and gets — encrypted.
 */
function isLiteralSecret(value: string): boolean {
  return value.length > 0 && !value.includes('{{')
}

/**
 * Same `secret`-flag treatment as {@link enc}/{@link dec}, but for
 * `KeyValuePair` (headers/params/request-scoped variables/form-data body
 * pairs) — a different, optional-`secret` shape than `Variable`'s required
 * one, so it needs its own pair of helpers rather than reusing those above.
 */
function encKV(codec: SecretCodec, pair: KeyValuePair): KeyValuePair {
  if (!pair.secret || !codec.isAvailable() || !isLiteralSecret(pair.value)) return pair
  return { ...pair, value: codec.encrypt(pair.value) }
}

function decKV(codec: SecretCodec, pair: KeyValuePair): KeyValuePair {
  if (!pair.secret || !codec.isAvailable()) return pair
  try {
    return { ...pair, value: codec.decrypt(pair.value) }
  } catch {
    return pair
  }
}

function encBody(codec: SecretCodec, body: RequestBody): RequestBody {
  if (body.type === 'form-data' || body.type === 'x-www-form-urlencoded') {
    return { ...body, pairs: body.pairs.map((p) => encKV(codec, p)) }
  }
  return body
}

function decBody(codec: SecretCodec, body: RequestBody): RequestBody {
  if (body.type === 'form-data' || body.type === 'x-www-form-urlencoded') {
    return { ...body, pairs: body.pairs.map((p) => decKV(codec, p)) }
  }
  return body
}

/**
 * Unlike `Variable`, an `AuthConfig`'s sensitive field isn't marked by a
 * `secret` flag — it's implied by which field it is for that auth type
 * (a Bearer token, a Basic password, an API key's *value*, but not its
 * *key name*). Everything not listed here (usernames, client ids, key
 * names, regions, custom instructions, `none`/`inherit`) is left as-is.
 */
function encAuth(codec: SecretCodec, auth: AuthConfig): AuthConfig {
  if (!codec.isAvailable()) return auth
  const encIf = (value: string): string => (isLiteralSecret(value) ? codec.encrypt(value) : value)
  switch (auth.type) {
    case 'inherit':
    case 'none':
    case 'custom':
      return auth
    case 'apiKey':
      return { ...auth, value: encIf(auth.value) }
    case 'bearer':
    case 'jwt':
      return { ...auth, token: encIf(auth.token) }
    case 'basic':
    case 'digest':
      return { ...auth, password: encIf(auth.password) }
    case 'oauth2':
      return { ...auth, clientSecret: encIf(auth.clientSecret), accessToken: encIf(auth.accessToken) }
    case 'oauth1':
      return {
        ...auth,
        consumerSecret: encIf(auth.consumerSecret),
        tokenSecret: auth.tokenSecret ? encIf(auth.tokenSecret) : auth.tokenSecret,
      }
    case 'aws':
      return {
        ...auth,
        secretKey: encIf(auth.secretKey),
        sessionToken: auth.sessionToken ? encIf(auth.sessionToken) : auth.sessionToken,
      }
  }
}

function decAuth(codec: SecretCodec, auth: AuthConfig): AuthConfig {
  if (!codec.isAvailable()) return auth
  try {
    switch (auth.type) {
      case 'inherit':
      case 'none':
      case 'custom':
        return auth
      case 'apiKey':
        return { ...auth, value: codec.decrypt(auth.value) }
      case 'bearer':
      case 'jwt':
        return { ...auth, token: codec.decrypt(auth.token) }
      case 'basic':
      case 'digest':
        return { ...auth, password: codec.decrypt(auth.password) }
      case 'oauth2':
        return { ...auth, clientSecret: codec.decrypt(auth.clientSecret), accessToken: codec.decrypt(auth.accessToken) }
      case 'oauth1':
        return {
          ...auth,
          consumerSecret: codec.decrypt(auth.consumerSecret),
          tokenSecret: auth.tokenSecret ? codec.decrypt(auth.tokenSecret) : auth.tokenSecret,
        }
      case 'aws':
        return {
          ...auth,
          secretKey: codec.decrypt(auth.secretKey),
          sessionToken: auth.sessionToken ? codec.decrypt(auth.sessionToken) : auth.sessionToken,
        }
    }
  } catch {
    return auth
  }
}

function encRequest(codec: SecretCodec, request: RequestModel): RequestModel {
  if (!codec.isAvailable()) return request
  return {
    ...request,
    auth: encAuth(codec, request.auth),
    headers: request.headers.map((h) => encKV(codec, h)),
    params: request.params.map((p) => encKV(codec, p)),
    variables: request.variables.map((v) => encKV(codec, v)),
    body: encBody(codec, request.body),
  }
}

function decRequest(codec: SecretCodec, request: RequestModel): RequestModel {
  if (!codec.isAvailable()) return request
  return {
    ...request,
    auth: decAuth(codec, request.auth),
    headers: request.headers.map((h) => decKV(codec, h)),
    params: request.params.map((p) => decKV(codec, p)),
    variables: request.variables.map((v) => decKV(codec, v)),
    body: decBody(codec, request.body),
  }
}

/** Shared by `Collection`/`CollectionDraft`/`CollectionPatch` — all structurally have an optional `auth`/`variables`. */
function encCollectionLike<T extends { auth?: AuthConfig; variables?: Variable[] }>(codec: SecretCodec, obj: T): T {
  if (!codec.isAvailable()) return obj
  return {
    ...obj,
    auth: obj.auth ? encAuth(codec, obj.auth) : obj.auth,
    variables: obj.variables ? obj.variables.map((v) => enc(codec, v)) : obj.variables,
  }
}

function decCollectionLike<T extends { auth?: AuthConfig; variables?: Variable[] }>(codec: SecretCodec, obj: T): T {
  if (!codec.isAvailable()) return obj
  return {
    ...obj,
    auth: obj.auth ? decAuth(codec, obj.auth) : obj.auth,
    variables: obj.variables ? obj.variables.map((v) => dec(codec, v)) : obj.variables,
  }
}

/** Shared by `Folder`/`FolderDraft`/`FolderPatch` — all structurally have an optional `auth`. */
function encFolderLike<T extends { auth?: AuthConfig }>(codec: SecretCodec, obj: T): T {
  if (!codec.isAvailable()) return obj
  return { ...obj, auth: obj.auth ? encAuth(codec, obj.auth) : obj.auth }
}

function decFolderLike<T extends { auth?: AuthConfig }>(codec: SecretCodec, obj: T): T {
  if (!codec.isAvailable()) return obj
  return { ...obj, auth: obj.auth ? decAuth(codec, obj.auth) : obj.auth }
}

/**
 * Wraps a {@link StorageProvider} so secret-bearing values — environment and
 * global variables (as always), plus collection variables and any
 * collection/folder/request auth's sensitive fields (a real, previously
 * silent gap: those had a `secret` toggle or looked exactly as sensitive as
 * an environment variable, but were never actually routed through this
 * codec) — are encrypted on write and decrypted on read. Every other call is
 * a transparent delegation, so the result still satisfies `StorageProvider`.
 */
export function withSecretCodec(inner: StorageProvider, codec: SecretCodec): StorageProvider {
  const decryptedEnv = (value: Environment | undefined): Environment | undefined =>
    value === undefined ? undefined : decEnv(codec, value)

  return new Proxy(inner, {
    get(target, prop, receiver) {
      switch (prop) {
        case 'saveEnvironment':
          return (environment: Environment) => target.saveEnvironment(encEnv(codec, environment))
        case 'getEnvironment': {
          const fn = target.getEnvironment.bind(target)
          return (id: string) => decryptedEnv(fn(id))
        }
        case 'listEnvironments':
          return (workspaceId: string) =>
            target.listEnvironments(workspaceId).map((e) => decEnv(codec, e))
        case 'saveGlobalVariable':
          return (variable: Variable) => target.saveGlobalVariable(enc(codec, variable))
        case 'listGlobalVariables':
          return (workspaceId: string) =>
            target.listGlobalVariables(workspaceId).map((v) => dec(codec, v))

        case 'createCollection':
          return (input: CollectionDraft) => decCollectionLike(codec, target.createCollection(encCollectionLike(codec, input)))
        case 'updateCollection':
          return (id: string, patch: CollectionPatch) => {
            const updated = target.updateCollection(id, encCollectionLike(codec, patch))
            return updated ? decCollectionLike(codec, updated) : updated
          }
        case 'getCollection': {
          const fn = target.getCollection.bind(target)
          return (id: string) => {
            const c = fn(id)
            return c ? decCollectionLike(codec, c) : c
          }
        }
        case 'listCollections':
          return (workspaceId: string) => target.listCollections(workspaceId).map((c) => decCollectionLike(codec, c))

        case 'createFolder':
          return (input: FolderDraft) => decFolderLike(codec, target.createFolder(encFolderLike(codec, input)))
        case 'updateFolder':
          return (id: string, patch: FolderPatch) => {
            const updated = target.updateFolder(id, encFolderLike(codec, patch))
            return updated ? decFolderLike(codec, updated) : updated
          }
        case 'listFolders':
          return (collectionId: string) => target.listFolders(collectionId).map((f) => decFolderLike(codec, f))

        case 'saveRequest':
          return (request: RequestModel) => target.saveRequest(encRequest(codec, request))
        case 'getRequest': {
          const fn = target.getRequest.bind(target)
          return (id: string) => {
            const r = fn(id)
            return r ? decRequest(codec, r) : r
          }
        }
        case 'listRequests':
          return (workspaceId: string) => target.listRequests(workspaceId).map((r) => decRequest(codec, r))

        default: {
          const value = Reflect.get(target, prop, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        }
      }
    },
  })
}