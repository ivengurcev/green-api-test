import Chat from './Chat.js';
import Login from './Login.js';
import useCredentials from './useCredentials.js'


export default function App() {
    const [credentials, credActions] = useCredentials();
    return credentials 
        ? <Chat credentials={credentials} />
        : <Login credentialsActions={credActions} />
}