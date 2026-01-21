<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

class CreateGameRoomRequest extends FormRequest
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
            'game_id' => ['required', 'integer', 'exists:games,id'],
            'name' => ['nullable', 'string', 'max:100'],
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
            'game_id.required' => 'Please select a game.',
            'game_id.exists' => 'The selected game does not exist.',
            'nickname.required' => 'Please enter a nickname.',
            'nickname.min' => 'Nickname must be at least 2 characters.',
            'nickname.max' => 'Nickname cannot exceed 20 characters.',
        ];
    }
}
