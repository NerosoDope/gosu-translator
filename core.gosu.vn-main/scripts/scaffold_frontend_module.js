#!/usr/bin/env node
/**
 * Frontend Module Scaffolding Script
 * 
 * Tạo module mới với cấu trúc chuẩn:
 * - Page component
 * - Query hooks (React Query)
 * - Table component
 * - Form component
 * 
 * Usage:
 *     node scripts/scaffold_frontend_module.js --name asset
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(BASE_DIR, 'frontend');
const APP_DIR = path.join(FRONTEND_DIR, 'src', 'app');

function createModuleStructure(moduleName) {
  const moduleDir = path.join(APP_DIR, '(portal)', moduleName);
  const hooksDir = path.join(FRONTEND_DIR, 'src', 'hooks');
  const componentsDir = path.join(FRONTEND_DIR, 'src', 'components', moduleName);
  
  // Create directories
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.mkdirSync(componentsDir, { recursive: true });
  
  // Page component
  const pageContent = `export default function ${capitalize(moduleName)}Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">${capitalize(moduleName)}</h1>
      <p className="text-gray-600 dark:text-gray-400">
        ${capitalize(moduleName)} management page
      </p>
      {/* TODO: Add table/form components */}
    </div>
  );
}
`;
  
  // Query hooks
  const hooksContent = `import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient, { ${moduleName}API } from '@/lib/api';

export function use${capitalize(moduleName)}List(params?: any) {
  return useQuery(
    ['${moduleName}', 'list', params],
    () => ${moduleName}API.getList(params),
    { keepPreviousData: true }
  );
}

export function use${capitalize(moduleName)}(id: number) {
  return useQuery(
    ['${moduleName}', id],
    () => ${moduleName}API.get(id),
    { enabled: !!id }
  );
}

export function useCreate${capitalize(moduleName)}() {
  const queryClient = useQueryClient();
  return useMutation(
    (data: any) => ${moduleName}API.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['${moduleName}']);
      },
    }
  );
}

export function useUpdate${capitalize(moduleName)}() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, data }: { id: number; data: any }) => ${moduleName}API.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['${moduleName}']);
      },
    }
  );
}

export function useDelete${capitalize(moduleName)}() {
  const queryClient = useQueryClient();
  return useMutation(
    (id: number) => ${moduleName}API.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['${moduleName}']);
      },
    }
  );
}
`;
  
  // Table component
  const tableContent = `'use client';

import { use${capitalize(moduleName)}List } from '@/hooks/use${capitalize(moduleName)}';

export default function ${capitalize(moduleName)}Table() {
  const { data, isLoading, error } = use${capitalize(moduleName)}List();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              ID
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((item: any) => (
            <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.id}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.name}
              </td>
              <td className="px-4 py-3 text-sm">
                <button className="text-blue-600 hover:text-blue-800">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`;
  
  // Write files
  fs.writeFileSync(path.join(moduleDir, 'page.tsx'), pageContent);
  fs.writeFileSync(path.join(hooksDir, `use${capitalize(moduleName)}.ts`), hooksContent);
  fs.writeFileSync(path.join(componentsDir, `${capitalize(moduleName)}Table.tsx`), tableContent);
  
  // Update API client
  const apiFile = path.join(FRONTEND_DIR, 'src', 'lib', 'api.ts');
  let apiContent = fs.readFileSync(apiFile, 'utf8');
  
  const apiAddition = `
// ${capitalize(moduleName)} API
export const ${moduleName}API = {
  getList: (params?: any) => apiClient.get(\`/${moduleName}\`, { params }),
  get: (id: number) => apiClient.get(\`/${moduleName}/\${id}\`),
  create: (data: any) => apiClient.post(\`/${moduleName}\`, data),
  update: (id: number, data: any) => apiClient.put(\`/${moduleName}/\${id}\`, data),
  delete: (id: number) => apiClient.delete(\`/${moduleName}/\${id}\`),
};
`;
  
  apiContent += apiAddition;
  fs.writeFileSync(apiFile, apiContent);
  
  console.log(`✅ Module '${moduleName}' created successfully!`);
  console.log(`📁 Location: ${moduleDir}`);
  console.log(`\n📝 Next steps:`);
  console.log(`1. Update page.tsx with your UI`);
  console.log(`2. Update hooks with your API endpoints`);
  console.log(`3. Update table component with your columns`);
  console.log(`4. Add route to sidebar menu`);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Parse arguments
const args = process.argv.slice(2);
const nameIndex = args.indexOf('--name');
if (nameIndex === -1 || !args[nameIndex + 1]) {
  console.error('❌ Error: --name argument is required');
  console.error('Usage: node scripts/scaffold_frontend_module.js --name asset');
  process.exit(1);
}

const moduleName = args[nameIndex + 1].toLowerCase().replace(/-/g, '_');

if (!/^[a-z_][a-z0-9_]*$/.test(moduleName)) {
  console.error(`❌ Error: '${moduleName}' is not a valid module name`);
  process.exit(1);
}

createModuleStructure(moduleName);

