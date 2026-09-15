import type { AuthConfig, AuthType } from '@vayntforge/engine'
import { SelectField, TextField } from './fields'
import type { RequestPanelProps } from './types'

const AUTH_OPTIONS: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'apiKey', label: 'API Key' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'oauth2', label: 'OAuth 2.0' },
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
    case 'jwt':
      return { type: 'jwt', token: '' }
    case 'aws':
      return { type: 'aws', accessKey: '', secretKey: '', region: '', service: '' }
    case 'custom':
      return { type: 'custom', instructions: '' }
  }
}

export function AuthorizationPanel({ draft, update }: RequestPanelProps) {
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
            onChange={(accessToken) => setAuth({ ...auth, accessToken })}
            type="password"
          />
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
