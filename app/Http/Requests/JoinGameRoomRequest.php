<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

class JoinGameRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<string>>
     */
    public function rules(): array
    {
        $rules = [
            'room_code' => ['required', 'string', 'size:6', 'alpha_num'],
        ];

        // Nickname required for guests, optional for authenticated users
        if (! Auth::check()) {
            $rules['nickname'] = ['required', 'string', 'min:2', 'max:20'];
        } else {
            $rules['nickname'] = ['nullable', 'string', 'min:2', 'max:20'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'room_code.required' => 'Please enter a room code.',
            'room_code.size' => 'Room codes are 6 characters long.',
            'room_code.alpha_num' => 'Room code must contain only letters and numbers.',
            'nickname.required' => 'Please enter a nickname.',
            'nickname.min' => 'Nickname must be at least 2 characters.',
            'nickname.max' => 'Nickname cannot exceed 20 characters.',
        ];
    }
}
