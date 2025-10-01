"use client";

import { useState, useEffect } from "react";
import { Button } from "@/modules/common/components/button";
import { Container } from "@/modules/layout/components/container";
import { Text } from "@/modules/common/components/text";
import { Heading } from "@/modules/common/components/heading";

interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  is_company: boolean;
  parent_company: string | null;
  created_at: string;
  updated_at: string;
}

interface OdooContactsResponse {
  success: boolean;
  message: string;
  data: {
    contacts: Contact[];
    count: number;
    companies: number;
    individuals: number;
  };
  config: {
    url: string;
    database: string;
    username: string;
  };
}

export default function OdooContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    count: number;
    companies: number;
    individuals: number;
  } | null>(null);
  const [config, setConfig] = useState<{
    url: string;
    database: string;
    username: string;
  } | null>(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/odoo-contacts');
      const data: OdooContactsResponse = await response.json();
      
      if (data.success) {
        setContacts(data.data.contacts);
        setStats({
          count: data.data.count,
          companies: data.data.companies,
          individuals: data.data.individuals
        });
        setConfig(data.config);
      } else {
        setError(data.message || 'Error al obtener contactos');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getContactTypeIcon = (isCompany: boolean) => {
    return isCompany ? "🏢" : "👤";
  };

  const getContactTypeText = (isCompany: boolean) => {
    return isCompany ? "Empresa" : "Persona";
  };

  if (loading) {
    return (
      <Container className="py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <Text>Cargando contactos de Odoo...</Text>
          </div>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-8">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <Heading level="h1" className="text-red-600 mb-4">
            Error al cargar contactos
          </Heading>
          <Text className="text-gray-600 mb-6">{error}</Text>
          <Button onClick={fetchContacts} className="bg-blue-600 hover:bg-blue-700">
            Reintentar
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="mb-8">
        <Heading level="h1" className="text-3xl font-bold mb-4">
          📞 Contactos de Odoo
        </Heading>
        
        {config && (
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <Text className="text-sm text-gray-600 mb-2">
              <strong>Configuración de conexión:</strong>
            </Text>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div><strong>URL:</strong> {config.url}</div>
              <div><strong>Base de datos:</strong> {config.database}</div>
              <div><strong>Usuario:</strong> {config.username}</div>
            </div>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.count}</div>
              <Text className="text-blue-800">Total Contactos</Text>
            </div>
            <div className="bg-green-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{stats.companies}</div>
              <Text className="text-green-800">Empresas</Text>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.individuals}</div>
              <Text className="text-purple-800">Personas</Text>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <Text className="text-gray-600">
            Mostrando {contacts.length} contactos
          </Text>
          <Button onClick={fetchContacts} className="bg-blue-600 hover:bg-blue-700">
            🔄 Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {getContactTypeIcon(contact.is_company)}
                </div>
                <div>
                  <Heading level="h3" className="text-lg font-semibold text-gray-900">
                    {contact.name}
                  </Heading>
                  <Text className="text-sm text-gray-500">
                    {getContactTypeText(contact.is_company)}
                  </Text>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                ID: {contact.id}
              </div>
            </div>

            <div className="space-y-2">
              {contact.email && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">📧</span>
                  <Text className="text-sm text-gray-600">{contact.email}</Text>
                </div>
              )}
              
              {contact.phone && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">📞</span>
                  <Text className="text-sm text-gray-600">{contact.phone}</Text>
                </div>
              )}
              
              {contact.mobile && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">📱</span>
                  <Text className="text-sm text-gray-600">{contact.mobile}</Text>
                </div>
              )}

              {contact.address.street && (
                <div className="flex items-start space-x-2">
                  <span className="text-gray-400 mt-1">📍</span>
                  <div className="text-sm text-gray-600">
                    <div>{contact.address.street}</div>
                    {contact.address.city && <div>{contact.address.city}</div>}
                    {contact.address.state && <div>{contact.address.state}</div>}
                    {contact.address.country && <div>{contact.address.country}</div>}
                  </div>
                </div>
              )}

              {contact.parent_company && (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">🏢</span>
                  <Text className="text-sm text-gray-600">
                    Empresa: {contact.parent_company}
                  </Text>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-xs text-gray-400">
                <div>
                  Creado: {formatDate(contact.created_at)}
                </div>
                <div>
                  Actualizado: {formatDate(contact.updated_at)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {contacts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📭</div>
          <Heading level="h2" className="text-gray-600 mb-2">
            No hay contactos disponibles
          </Heading>
          <Text className="text-gray-500">
            No se encontraron contactos en Odoo o hubo un problema con la conexión.
          </Text>
        </div>
      )}
    </Container>
  );
}
