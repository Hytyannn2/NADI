import { useEffect } from 'react';

export function useAuth() {
    return{
        user: { id: 'citizen123', name: 'Citizen Malay', role: 'user' },
        isAuthenticated: true,
        login: () => console.log('Login logic'),
        logout: () => console.log('Logout logic')
    };
}