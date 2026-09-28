import Chat from './Chat.js';
import Login from './Login.js';
import { createGreenApiClient } from './api/greenApiClient.js';
import type { Credentials, GreenApiClient } from './api/types.js';
import useCredentials from './useCredentials.js'

export type ClientFactory = (credentials: Credentials) => GreenApiClient;

type AppProps = {
    clientFactory?: ClientFactory;
};

export default function App({clientFactory = createGreenApiClient}: AppProps = {}) {
    const [credentials, credActions] = useCredentials();
    return credentials 
        ? <Chat client={clientFactory(credentials)} />
        : <Login credentialsActions={credActions} clientFactory={clientFactory} />
}
