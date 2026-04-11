import React from 'react';
import { Coffee } from 'lucide-react';
import { loginWithGoogle } from '../firebase';

export function Login() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Coffee className="h-12 w-12 text-amber-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          EduCafe
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Simulador de Cafeteria Educacional
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <button
            onClick={loginWithGoogle}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    </div>
  );
}
