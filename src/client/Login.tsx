import type { CredentialActions } from './useCredentials.js';

export default function Login({credentialsActions}: {credentialsActions: CredentialActions}) {
    const {login, logout} = credentialsActions;

    console.log(login, logout);

    return <div>
        <form>
            <input />
            <input />
            <button type='submit' />
        </form>
    </div>
}