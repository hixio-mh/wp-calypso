/**
 * Internal dependencies
 */
import { withStorageKey } from '@automattic/state-utils';
import { DROPZONE_SHOW, DROPZONE_HIDE } from 'calypso/state/action-types';
import { combineReducers } from 'calypso/state/utils';

// TODO(biskobe) - Can be improved with `keyedReducer` instead of state spread.
const isVisible = ( state = {}, action ) => {
	switch ( action.type ) {
		case DROPZONE_SHOW: {
			const { dropZoneName } = action;

			return {
				...state,
				[ dropZoneName ]: true,
			};
		}
		case DROPZONE_HIDE: {
			const { dropZoneName } = action;

			return {
				...state,
				[ dropZoneName ]: false,
			};
		}
	}

	return state;
};

const combinedReducer = combineReducers( {
	isVisible,
} );

export default withStorageKey( 'dropZone', combinedReducer );
