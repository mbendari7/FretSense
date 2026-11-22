import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './Layout';
import { HomeScreen } from './screens/HomeScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { KeysScreen } from './screens/KeysScreen';
import { LibraryScreen, LessonScreen } from './screens/LessonScreens';
import { DrillsHome, DrillScreen } from './screens/DrillsScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { GearScreen } from './screens/GearScreen';
import { NotFound } from './screens/NotFound';

/** Routes (contracts/ui-routes.md). Every route opens on a fresh profile; nothing is locked. */
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/explore', element: <ExploreScreen /> },
      { path: '/keys', element: <KeysScreen /> },
      { path: '/library', element: <LibraryScreen /> },
      { path: '/lessons/:lessonId', element: <LessonScreen /> },
      { path: '/lessons/:lessonId/drill/:drillId', element: <LessonScreen /> },
      { path: '/lessons/:lessonId/:stage', element: <LessonScreen /> },
      { path: '/drills', element: <DrillsHome /> },
      { path: '/drills/:type', element: <DrillScreen /> },
      { path: '/progress', element: <ProgressScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/gear/instruments', element: <GearScreen /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
