import {BrowserRouter, Switch, Route} from 'react-router-dom';
import Room from './pages/Room';
import Main from './pages/Main';
import NotFound404 from './pages/NotFound404';
import Register from './pages/Auth/Register';
import Login from './pages/Auth/Login';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path='/room/:id' component={Room}/>
        <Route exact path='/' component={Main}/>
        <Route exact path='/auth/register' component={Register}/>
        <Route exact path='/auth/login' component={Login}/>
        <Route exact path='/settings' component={Settings}/>
        <Route component={NotFound404}/>
      </Switch>
    </BrowserRouter>
  );
}

export default App;
