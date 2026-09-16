import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AuthConfig, AuthType, OAuth2Config } from '@vayntforge/engine'
import { Button } from '@vayntforge/ui'
import { SelectField, TextField } from './fields'
import type { RequestPanelProps } from './types'

const AUTH_OPTIONS: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'apiKey', label: 'API Key' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'oauth1', label: 'OAuth 1.0' },
  { value: 'digest', label: 'Digest Auth' },
  { value: 'jwt', label: 'JWT Bearer' },
  { value: 'aws', label: 'AWS Signature' },
  { value: 'custom', label: 'Custom' },
]

function defaultAuthFor(type: AuthType): AuthConfig {
  switch (type) {
    case 'none':
      return { type: 'none' }
    case 'apiKey':
      return { type: 'apiKey', location: 'header', key: '', value: '' }
    case 'bearer':
      return { type: 'bearer', token: '' }
    case 'basic':
      return { type: 'basic', username: '', password: '' }
    case 'oauth2':
      return {
        type: 'oauth2',
        grantType: 'client_credentials',
        tokenUrl: '',
        clientId: '',
        clientSecret: '',
        scopes: '',
        accessToken: '',
      }
    case 'oauth1':
      return {
        type: 'oauth1',
        consumerKey: '',
        consumerSecret: '',
        token: '',
        tokenSecret: '',
        signatureMethod: 'HMAC-SHA1',
      }
    case 'digest':
      return { type: 'digest', username: '', password: '' }
    case 'jwt':
      return { type: 'jwt', token: '' }
    case 'aws':
      return { type: 'aws', accessKey: '', secretKey: '', region: '', service: '' }
    case 'custom':
      return { type: 'custom', instructions: '' }
  }
}

function TokenFetchStatus({
  auth,
  setAuth,
  resolveTemplate,
}: {
  auth: OAuth2Config
  setAuth(next: OAuth2Config): void
  resolveTemplate?: (template: string) => string
}) {
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  const getToken = async () => {
    setFetching(true)
    setError(null)
    const resolve = resolveTemplate ?? ((s: string) => s)
    try {
      const result = await window.vayntforge.network.fetchOAuth2Token({
        ...auth,
        tokenUrl: resolve(auth.tokenUrl),
        clientId: resolve(auth.clientId),
        clientSecret: resolve(auth.clientSecret),
        scopes: resolve(auth.scopes),
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setAuth({ ...auth, accessToken: result.accessToken ?? '', tokenExpiresAt: result.expiresAt })
      setFetchedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setFetching(false)
    }
  }

  const expiresLabel = (() => {
    if (!auth.tokenExpiresAt) return null
    const remainingMs = auth.tokenExpiresAt - Date.now()
    if (remainingMs <= 0) return 'Token expired — fetch a new one.'
    const mins = Math.round(remainingMs / 60000)
    return mins < 1 ? 'Token expires in under a minute.' : `Token expires in ~${mins} minute${mins === 1 ? '' : 's'}.`
  })()

  return (
    <div className="col-span-2 flex items-center gap-3 border-t border-border pt-3">
      <Button size="sm" variant="outline" onClick={() => void getToken()} disabled={fetching}>
        {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {fetching ? 'Requesting token…' : 'Get New Access Token'}
      </Button>
      {error && <span className="text-[12px] text-err">{error}</span>}
      {!error && fetchedAt && <span className="text-[12px] text-ok">Token fetched successfully.</span>}
      {!error && !fetchedAt && expiresLabel && <span className="text-[12px] text-faint">{expiresLabel}</span>}
    </div>
  )
}

export function AuthorizationPanel({ draft, update, resolveTemplate }: RequestPanelProps) {
  const auth = draft.auth
  const setAuth = (next: AuthConfig) => update((d) => ({ ...d, auth: next }))

  return (
    <div className="space-y-4 p-3">
      <SelectField
        label="Type"
        value={auth.type}
        onChange={(type) => setAuth(defaultAuthFor(type))}
        options={AUTH_OPTIONS}
      />

      {auth.type === 'none' && (
        <p className="text-[12px] text-faint">This request does not use authorization.</p>
      )}

      {auth.type === 'apiKey' && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Add to"
            value={auth.location}
            onChange={(location) => setAuth({ ...auth, location })}
            options={[
              { value: 'header', label: 'Header' },
              { value: 'query', label: 'Query Param' },
            ]}
          />
          <TextField label="Key" value={auth.key} onChange={(key) => setAuth({ ...auth, key })} placeholder="X-API-Key" />
          <div className="col-span-2">
            <TextField
              label="Value"
              value={auth.value}
              onChange={(value) => setAuth({ ...auth, value })}
              type="password"
            />
          </div>
        </div>
      )}

      {auth.type === 'bearer' && (
        <TextField label="Token" value={auth.token} onChange={(token) => setAuth({ ...auth, token })} type="password" />
      )}

      {auth.type === 'basic' && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Username" value={auth.username} onChange={(username) => setAuth({ ...auth, username })} />
          <TextField
            label="Password"
            value={auth.password}
            onChange={(password) => setAuth({ ...auth, password })}
            type="password"
          />
        </div>
      )}

      {auth.type === 'oauth2' && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Grant type"
            value={auth.grantType}
            onChange={(grantType) => setAuth({ ...auth, grantType })}
            options={[
              { value: 'client_credentials', label: 'Client Credentials' },
              { value: 'authorization_code', label: 'Authorization Code' },
              { value: 'password', label: 'Password' },
            ]}
          />
          <TextField label="Token URL" value={auth.tokenUrl} onChange={(tokenUrl) => setAuth({ ...auth, tokenUrl })} />
          {auth.grantType === 'authorization_code' && (
            <TextField
              label="Auth URL"
              value={auth.authUrl ?? ''}
              onChange={(authUrl) => setAuth({ ...auth, authUrl })}
            />
          )}
          <TextField label="Client ID" value={auth.clientId} onChange={(clientId) => setAuth({ ...auth, clientId })} />
          <TextField
            label="Client Secret"
            value={auth.clientSecret}
            onChange={(clientSecret) => setAuth({ ...auth, clientSecret })}
            type="password"
          />
          <TextField label="Scopes" value={auth.scopes} onChange={(scopes) => setAuth({ ...auth, scopes })} placeholder="read write" />
          <TextField
            label="Access Token"
            value={auth.accessToken}
            onChange={(accessToken) => setAuth({ ...auth, accessToken, tokenExpiresAt: undefined })}
            type="password"
          />
          {auth.grantType === 'client_credentials' ? (
            <TokenFetchStatus auth={auth} setAuth={setAuth} resolveTemplate={resolveTemplate} />
          ) : (
            <p className="col-span-2 text-[11px] text-faint">
              Automatic token fetch is only built for Client Credentials — for {auth.grantType === 'authorization_code' ? 'Authorization Code' : 'Password'}, paste a token you obtained elsewhere into Access Token above (or resolve one via a pre-request script).
            </p>
          )}
        </div>
      )}

      {auth.type === 'oauth1' && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Signature method"
            value={auth.signatureMethod}
            onChange={(signatureMethod) => setAuth({ ...auth, signatureMethod })}
            options={[
              { value: 'HMAC-SHA1', label: 'HMAC-SHA1' },
              { value: 'PLAINTEXT', label: 'PLAINTEXT' },
            ]}
          />
          <div />
          <TextField
            label="Consumer Key"
            value={auth.consumerKey}
            onChange={(consumerKey) => setAuth({ ...auth, consumerKey })}
          />
          <TextField
            label="Consumer Secret"
            value={auth.consumerSecret}
            onChange={(consumerSecret) => setAuth({ ...auth, consumerSecret })}
            type="password"
          />
          <TextField label="Token" value={auth.token} onChange={(token) => setAuth({ ...auth, token })} />
          <TextField
            label="Token Secret"
            value={auth.tokenSecret}
            onChange={(tokenSecret) => setAuth({ ...auth, tokenSecret })}
            type="password"
          />
          <p className="col-span-2 text-[11px] text-faint">
            Signs the request with a real OAuth 1.0a signature (RFC 5849). Leave Token/Token Secret blank for the
            two-legged flow.
          </p>
        </div>
      )}

      {auth.type === 'digest' && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Username" value={auth.username} onChange={(username) => setAuth({ ...auth, username })} />
          <TextField
            label="Password"
            value={auth.password}
            onChange={(password) => setAuth({ ...auth, password })}
            type="password"
          />
          <p className="col-span-2 text-[11px] text-faint">
            Realm, nonce, and qop come from the server's real 401 challenge — the request is sent once to receive
            that challenge, then resent with the computed digest response.
          </p>
        </div>
      )}

      {auth.type === 'jwt' && (
        <TextField label="Token" value={auth.token} onChange={(token) => setAuth({ ...auth, token })} type="password" />
      )}

      {auth.type === 'aws' && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Access Key" value={auth.accessKey} onChange={(accessKey) => setAuth({ ...auth, accessKey })} />
          <TextField
            label="Secret Key"
            value={auth.secretKey}
            onChange={(secretKey) => setAuth({ ...auth, secretKey })}
            type="password"
          />
          <TextField label="Region" value={auth.region} onChange={(region) => setAuth({ ...auth, region })} placeholder="us-east-1" />
          <TextField label="Service" value={auth.service} onChange={(service) => setAuth({ ...auth, service })} placeholder="execute-api" />
        </div>
      )}

      {auth.type === 'custom' && (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-faint">Instructions</label>
          <textarea
            value={auth.instructions}
            onChange={(e) => setAuth({ ...auth, instructions: e.target.value })}
            rows={4}
            placeholder="Describe the custom auth scheme (applied via pre-request script)."
            className="w-full resize-y rounded-md border border-border bg-bg-input p-2 text-[12px] text-text outline-none focus:border-accent"
          />
        </div>
      )}
    </div>
  )
}
