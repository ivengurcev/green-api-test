import { useState } from 'react'

export type Credentials = {
    idInstance: string,
    apiTokenInstance: string
}

export type CredentialActions = {
    login: (credentials: Credentials) => void
    logout: () => void        
}

export default function useCredentials():[Credentials | null, CredentialActions] {

    const [credentials, setCredential] =  useState<Credentials | null>(null);
    function login(credentials: Credentials) {
        setCredential(credentials);
    }

    function logout() {
        setCredential(null);
    }

    return [credentials, {login, logout}]
}