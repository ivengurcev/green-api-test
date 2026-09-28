import type { Credentials } from './useCredentials.js';
export default function Chat({credentials}: {credentials: Credentials}) {
    console.log(credentials);
    return (<div>
        ЧАТ
    </div>)
}